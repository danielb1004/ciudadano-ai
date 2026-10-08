import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { postgres } from "./index.js";
type Entry<T> = { value: T; expiresAt: number };
const encryptionKey = () => {
  const hex = process.env.DATA_ENCRYPTION_KEY;
  if (hex && !/^[a-f\d]{64}$/i.test(hex)) throw new Error("DATA_ENCRYPTION_KEY debe tener 64 caracteres hexadecimales.");
  if (!hex && process.env.NODE_ENV === "production") throw new Error("Configura DATA_ENCRYPTION_KEY antes de iniciar producción.");
  return hex ? Buffer.from(hex, "hex") : undefined;
};
export function encode(value: unknown): string {
  const key = encryptionKey(), text = JSON.stringify(value); if (!key) return text;
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return JSON.stringify({ encrypted: true, iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex"), data: data.toString("base64") });
}
export function decode<T>(text: string): T {
  const data = JSON.parse(text); if (!data.encrypted) return data as T;
  const key = encryptionKey(); if (!key) throw new Error("Falta la clave para descifrar datos.");
  const cipher = createDecipheriv("aes-256-gcm", key, Buffer.from(data.iv, "hex")); cipher.setAuthTag(Buffer.from(data.tag, "hex"));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(data.data, "base64")), cipher.final()]).toString("utf8")) as T;
}
/** PostgreSQL is authoritative when configured. Memory is for local development. */
export class Store<T> {
  private memory = new Map<string, Entry<T>>();
  private locks = new Map<string, Promise<unknown>>();
  private table: string;
  constructor(schema: string, private namespace: string) {
    if (!/^[a-z]+$/.test(schema)) throw new Error("Invalid store schema");
    this.table = schema + ".app_state"; encryptionKey();
  }
  async get(key: string): Promise<T | undefined> {
    if (postgres) {
      const { rows } = await postgres.query("SELECT data FROM " + this.table + " WHERE namespace=$1 AND key=$2 AND expires_at>now()", [this.namespace, key]);
      return rows[0] ? decode<T>(rows[0].data) : undefined;
    }
    const entry = this.memory.get(key);
    if (!entry || entry.expiresAt <= Date.now()) { this.memory.delete(key); return undefined; }
    return structuredClone(entry.value);
  }
  async set(key: string, value: T, ttlSeconds = 30 * 86400): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    if (postgres) await postgres.query("INSERT INTO " + this.table + "(namespace,key,data,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT(namespace,key) DO UPDATE SET data=EXCLUDED.data,expires_at=EXCLUDED.expires_at", [this.namespace, key, encode(value), new Date(expiresAt)]);
    else this.memory.set(key, { value: structuredClone(value), expiresAt });
  }
  async remove(key: string): Promise<void> {
    if (postgres) await postgres.query("DELETE FROM " + this.table + " WHERE namespace=$1 AND key=$2", [this.namespace, key]); else this.memory.delete(key);
  }
  async list(): Promise<Array<{ key: string; value: T }>> {
    if (postgres) {
      const { rows } = await postgres.query("SELECT key,data FROM " + this.table + " WHERE namespace=$1 AND expires_at>now() ORDER BY key", [this.namespace]);
      return rows.map(row => ({ key: row.key as string, value: decode<T>(row.data) }));
    }
    await this.cleanup(); return [...this.memory].map(([key, { value }]) => ({ key, value: structuredClone(value) }));
  }
  async cleanup(): Promise<void> {
    if (postgres) await postgres.query("DELETE FROM " + this.table + " WHERE namespace=$1 AND expires_at<=now()", [this.namespace]);
    else for (const [key, entry] of this.memory) if (entry.expiresAt <= Date.now()) this.memory.delete(key);
  }
  async mutate<R>(key: string, operation: (value: T | undefined) => Promise<{ value?: T; result: R; ttlSeconds?: number }>): Promise<R> {
    if (postgres) {
      const client = await postgres.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [this.table + ":" + this.namespace + ":" + key]);
        const { rows } = await client.query("SELECT data FROM " + this.table + " WHERE namespace=$1 AND key=$2 AND expires_at>now()", [this.namespace, key]);
        const next = await operation(rows[0] ? decode<T>(rows[0].data) : undefined);
        if (next.value === undefined) await client.query("DELETE FROM " + this.table + " WHERE namespace=$1 AND key=$2", [this.namespace, key]);
        else await client.query("INSERT INTO " + this.table + "(namespace,key,data,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT(namespace,key) DO UPDATE SET data=EXCLUDED.data,expires_at=EXCLUDED.expires_at", [this.namespace, key, encode(next.value), new Date(Date.now() + (next.ttlSeconds ?? 30 * 86400) * 1000)]);
        await client.query("COMMIT"); return next.result;
      } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    }
    const previous = this.locks.get(key) ?? Promise.resolve();
    const task = previous.catch(() => {}).then(async () => {
      const next = await operation(await this.get(key));
      if (next.value === undefined) await this.remove(key); else await this.set(key, next.value, next.ttlSeconds);
      return next.result;
    });
    this.locks.set(key, task);
    try { return await task; } finally { if (this.locks.get(key) === task) this.locks.delete(key); }
  }
}
