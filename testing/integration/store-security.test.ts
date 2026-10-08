import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const database = vi.hoisted(() => {
  const records = new Map<string,{ key:string; data:string; expiry:number }>();
  const calls: string[] = [];
  let fail = false;
  const query = vi.fn(async (sql:string,args:any[]=[]) => {
    calls.push(sql); if(fail && sql.startsWith("INSERT")) throw new Error("database unavailable");
    if(sql.startsWith("INSERT")) { records.set(args[0]+":"+args[1],{key:args[1],data:args[2],expiry:+args[3]}); return {rows:[]}; }
    if(sql.startsWith("DELETE")) { for(const [key,value] of records) if(key.startsWith(args[0]+":") && (args.length>1 ? value.key===args[1] : value.expiry<=Date.now())) records.delete(key); return {rows:[]}; }
    if(sql.startsWith("SELECT data")) { const value=records.get(args[0]+":"+args[1]); return {rows:value && value.expiry>Date.now() ? [value] : []}; }
    if(sql.startsWith("SELECT key,data")) return {rows:[...records.entries()].filter(([key,value])=>key.startsWith(args[0]+":") && value.expiry>Date.now()).map(([,value])=>value)};
    return {rows:[]};
  });
  const release=vi.fn();
  return { records,calls,query,release,setFail:(value:boolean)=>{fail=value;}, pool:{query,connect:vi.fn(async()=>({query,release}))} };
});
vi.mock("../../shared/src/index.js",()=>({postgres:database.pool}));
import { Store } from "../../shared/src/store.js";
beforeEach(()=>{ database.records.clear(); database.calls.length=0; database.setFail(false); process.env.DATA_ENCRYPTION_KEY="ab".repeat(32); });
afterEach(()=>{ delete process.env.DATA_ENCRYPTION_KEY; delete process.env.NODE_ENV; });
describe("Persistent storage confidentiality and failure handling",()=>{
  it("encrypts sensitive values using AES-256-GCM and retrieves them",async()=>{
    const store=new Store<{secret:string}>("profiles","test");
    await store.set("one",{secret:"private-citizen-data"});
    const saved=[...database.records.values()][0].data;
    expect(saved).not.toContain("private-citizen-data"); expect(JSON.parse(saved).encrypted).toBe(true);
    expect(await store.get("one")).toEqual({secret:"private-citizen-data"});
    expect((await store.list())[0].value.secret).toBe("private-citizen-data");
  });
  it("uses a fresh nonce for identical data",async()=>{
    const store=new Store<any>("profiles","nonce"); await store.set("one",{secret:"same"}); await store.set("two",{secret:"same"});
    const [a,b]=[...database.records.values()]; expect(JSON.parse(a.data).iv).not.toBe(JSON.parse(b.data).iv);
  });
  it("fails closed after ciphertext or key tampering",async()=>{
    const store=new Store<any>("profiles","tamper"); await store.set("one",{secret:"private"});
    const row=[...database.records.values()][0], value=JSON.parse(row.data); value.tag="00".repeat(16); row.data=JSON.stringify(value);
    await expect(store.get("one")).rejects.toThrow();
    await store.set("one",{secret:"private"}); process.env.DATA_ENCRYPTION_KEY="cd".repeat(32); await expect(store.get("one")).rejects.toThrow();
  });
  it("rejects missing and malformed production encryption keys",()=>{
    process.env.NODE_ENV="production"; delete process.env.DATA_ENCRYPTION_KEY;
    expect(()=>new Store("profiles","missing")).toThrow(/DATA_ENCRYPTION_KEY/);
    process.env.DATA_ENCRYPTION_KEY="short"; expect(()=>new Store("profiles","bad")).toThrow(/64/);
    expect(()=>new Store("unsafe;DROP","bad")).toThrow();
  });
  it("expires and physically removes stale rows",async()=>{
    const store=new Store<any>("profiles","expiry"); await store.set("one",{a:1},-1);
    expect(await store.get("one")).toBeUndefined(); await store.cleanup(); expect(database.records.size).toBe(0);
  });
  it("persists atomic mutation and deletion under a PostgreSQL transaction",async()=>{
    const store=new Store<number>("auth","counter");
    expect(await store.mutate("one",async old=>({value:(old??0)+1,result:"ok"}))).toBe("ok"); expect(await store.get("one")).toBe(1);
    expect(database.calls.some(sql=>sql.includes("pg_advisory_xact_lock"))).toBe(true); expect(database.calls).toContain("COMMIT");
    await store.mutate("one",async()=>({result:"consumed"})); expect(await store.get("one")).toBeUndefined();
  });
  it("rolls back and releases the connection on database failure",async()=>{
    const store=new Store<number>("auth","rollback"); database.setFail(true);
    await expect(store.mutate("one",async()=>({value:1,result:1}))).rejects.toThrow(/unavailable/);
    expect(database.calls).toContain("ROLLBACK"); expect(database.release).toHaveBeenCalled();
  });
  it("supports local development without storing an unencrypted production value",async()=>{
    delete process.env.DATA_ENCRYPTION_KEY; process.env.NODE_ENV="test"; const store=new Store<any>("profiles","plain-local");
    await store.set("one",{flag:true}); expect(await store.get("one")).toEqual({flag:true}); await store.remove("one"); expect(await store.get("one")).toBeUndefined();
  });
});
