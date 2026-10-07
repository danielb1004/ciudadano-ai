import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createBaseApp, logger, makeEvent, publishEvent } from "@ciudadano-ai/shared";
import { rateLimit } from "@ciudadano-ai/shared/http";
import { z } from "zod";

export type Admin = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  roles: string[];
  permissions: string[];
  revoked: boolean;
  createdAt: string;
};

const admins = new Map<string, Admin>();
const refreshTokens = new Map<string, string>();
const failedAttempts = new Map<string, number>();

const accessSecret = () => process.env.JWT_SECRET ?? "development-only-change-me-32-bytes";
const loginInput = z.object({
  email: z.string().email().max(160),
  password: z.string().min(8).max(200)
});

// Semilla inicial de administrador del sistema
async function seedDefaultAdmin() {
  const defaultEmail = "admin@ciudadano.gov.co";
  if (![...admins.values()].some((a) => a.email === defaultEmail)) {
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD ?? "AdminCiudadano2026!";
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    const admin: Admin = {
      id: "admin-system-master",
      email: defaultEmail,
      name: "Administrador General",
      passwordHash,
      roles: ["super_admin", "catalog_manager", "auditor"],
      permissions: ["catalog_read", "catalog_write", "audit_read", "ml_manage", "users_manage"],
      revoked: false,
      createdAt: new Date().toISOString()
    };
    admins.set(admin.id, admin);
    logger.info({ email: defaultEmail }, "Default administrator user ready");
  }
}

void seedDefaultAdmin();

const app = createBaseApp("auth-service");
app.use(rateLimit(60, 60_000));

const issueTokens = (admin: Admin) => ({
  accessToken: jwt.sign(
    { sub: admin.id, email: admin.email, name: admin.name, roles: admin.roles, permissions: admin.permissions },
    accessSecret(),
    { expiresIn: (process.env.JWT_ACCESS_TTL ?? "1h") as any }
  ),
  refreshToken: randomUUID(),
  user: {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    roles: admin.roles,
    permissions: admin.permissions
  }
});

app.post("/api/v1/auth/login", async (req, res) => {
  const parsed = loginInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Credenciales inválidas." } });

  const admin = [...admins.values()].find((item) => item.email.toLowerCase() === parsed.data.email.toLowerCase());
  const valid = admin && !admin.revoked && (await bcrypt.compare(parsed.data.password, admin.passwordHash));

  if (!valid) {
    const count = (failedAttempts.get(parsed.data.email) ?? 0) + 1;
    failedAttempts.set(parsed.data.email, count);
    await publishEvent(
      makeEvent("security.access.failed", "auth-service", {
        emailHash: createHash("sha256").update(parsed.data.email).digest("hex"),
        attemptCount: count
      })
    );
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Correo o contraseña incorrectos." } });
  }

  failedAttempts.delete(parsed.data.email);
  const authResponse = issueTokens(admin);
  refreshTokens.set(authResponse.refreshToken, admin.id);

  await publishEvent(
    makeEvent("security.user.authenticated", "auth-service", {
      adminId: admin.id,
      email: admin.email,
      roles: admin.roles
    })
  );

  res.json(authResponse);
});

app.post("/api/v1/auth/refresh", (req, res) => {
  const token = req.body?.refreshToken;
  const adminId = token ? refreshTokens.get(token) : undefined;
  const admin = adminId ? admins.get(adminId) : undefined;

  if (!admin || admin.revoked) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Refresh token inválido o expirado." } });
  }

  const authResponse = issueTokens(admin);
  refreshTokens.delete(token);
  refreshTokens.set(authResponse.refreshToken, admin.id);

  res.json(authResponse);
});

app.post("/api/v1/auth/logout", (req, res) => {
  if (req.body?.refreshToken) {
    refreshTokens.delete(req.body.refreshToken);
  }
  res.status(204).send();
});

app.get("/api/v1/auth/me", (req, res) => {
  try {
    const token = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("No token provided");
    const claims = jwt.verify(token, accessSecret());
    res.json(claims);
  } catch {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Autenticación requerida." } });
  }
});

app.get("/api/v1/auth/admins", (_req, res) => {
  const list = [...admins.values()].map(({ id, email, name, roles, permissions, revoked, createdAt }) => ({
    id, email, name, roles, permissions, revoked, createdAt
  }));
  res.json({ admins: list, count: list.length });
});

app.post("/api/v1/auth/admins", async (req, res) => {
  const createSchema = loginInput.extend({
    name: z.string().min(2).default("Administrador"),
    roles: z.array(z.string()).default(["catalog_reader"]),
    permissions: z.array(z.string()).default(["catalog_read"])
  });

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Datos de usuario inválidos." } });

  const existing = [...admins.values()].find((a) => a.email === parsed.data.email);
  if (existing) return res.status(409).json({ error: { code: "CONFLICT", message: "El correo ya está registrado." } });

  const admin: Admin = {
    id: randomUUID(),
    email: parsed.data.email,
    name: parsed.data.name,
    passwordHash: await bcrypt.hash(parsed.data.password, 10),
    roles: parsed.data.roles,
    permissions: parsed.data.permissions,
    revoked: false,
    createdAt: new Date().toISOString()
  };

  admins.set(admin.id, admin);
  res.status(201).json({ id: admin.id, email: admin.email, name: admin.name, roles: admin.roles, permissions: admin.permissions });
});

if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3004);
  const server = app.listen(port, () => logger.info({ port }, "auth-service listening"));
  const shutdown = () => server.close(() => process.exit(0));
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
