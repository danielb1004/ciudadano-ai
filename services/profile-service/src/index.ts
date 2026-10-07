import { randomUUID } from "node:crypto";
import { createBaseApp, logger, makeEvent, publishEvent, CitizenProfile, Consent, query } from "@ciudadano-ai/shared";
import { z } from "zod";

const profiles = new Map<string, CitizenProfile>();

const profileInput = z.object({
  anonymous: z.boolean().default(true),
  preferences: z
    .object({
      fontScale: z.number().min(0.8).max(2.0).optional(),
      concise: z.boolean().optional(),
      highContrast: z.boolean().optional(),
      speechEnabled: z.boolean().optional()
    })
    .default({}),
  techExperience: z.string().max(50).optional()
});

const consentInput = z.object({
  purpose: z.enum(["conversation_context", "usability_research", "analytics"]),
  version: z.string().default("1.0"),
  granted: z.boolean().default(true)
});

const app = createBaseApp("profile-service");

// Crear perfil ciudadano
app.post("/api/v1/profiles", (req, res) => {
  const parsed = profileInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Perfil inválido." } });

  const profile: CitizenProfile = {
    id: randomUUID(),
    anonymous: parsed.data.anonymous,
    preferences: parsed.data.preferences,
    techExperience: parsed.data.techExperience,
    consents: [
      {
        id: randomUUID(),
        purpose: "conversation_context",
        granted: true,
        version: "1.0",
        createdAt: new Date().toISOString()
      }
    ]
  };

  profiles.set(profile.id, profile);
  void query(
    "INSERT INTO profiles.citizen_profiles (id, anonymous, preferences, tech_experience) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING",
    [profile.id, profile.anonymous, profile.preferences, profile.techExperience]
  );
  void publishEvent(makeEvent("profile.created", "profile-service", { profileId: profile.id, anonymous: profile.anonymous }));

  res.status(201).json(profile);
});

// Obtener perfil por ID
app.get("/api/v1/profiles/:id", (req, res) => {
  const profile = profiles.get(req.params.id);
  if (!profile) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Perfil no encontrado." } });
  res.json(profile);
});

// Actualizar preferencias o datos del perfil
app.patch("/api/v1/profiles/:id", (req, res) => {
  let profile = profiles.get(req.params.id);
  if (!profile) {
    // Si no existe, lo inicializamos para soporte transparente
    profile = {
      id: req.params.id,
      anonymous: true,
      preferences: {},
      consents: []
    };
    profiles.set(profile.id, profile);
  }

  const patch = profileInput.partial().safeParse(req.body);
  if (!patch.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Actualización inválida." } });

  const updated: CitizenProfile = {
    ...profile,
    ...patch.data,
    preferences: { ...profile.preferences, ...patch.data.preferences }
  };

  profiles.set(profile.id, updated);
  void publishEvent(makeEvent("profile.updated", "profile-service", { profileId: profile.id, preferences: updated.preferences }));
  res.json(updated);
});

// Exportar todos los datos del ciudadano (Derecho de Acceso - Habeas Data)
app.get("/api/v1/profiles/:id/export", (req, res) => {
  const profile = profiles.get(req.params.id);
  if (!profile) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Perfil no encontrado para exportar." } });
  }

  const dossier = {
    dossierId: randomUUID(),
    exportedAt: new Date().toISOString(),
    retentionPolicy: "30 días de inactividad o eliminación voluntaria",
    citizenData: {
      profileId: profile.id,
      anonymous: profile.anonymous,
      preferences: profile.preferences,
      techExperience: profile.techExperience ?? "no_especificado",
      activeConsents: profile.consents.filter((c) => c.granted),
      revokedConsents: profile.consents.filter((c) => !c.granted),
      totalConsentRecords: profile.consents.length
    },
    privacyGuarantee: "No se recopilan nombres, cédulas ni contraseñas. Toda consulta es anonimizada por diseño."
  };

  res.json(dossier);
});

// Borrado total de datos del ciudadano (Derecho al Olvido / Supresión)
app.delete("/api/v1/profiles/:id/data", async (req, res) => {
  const exists = profiles.has(req.params.id);
  if (!exists) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Perfil no encontrado." } });
  }

  profiles.delete(req.params.id);
  void query("UPDATE profiles.citizen_profiles SET deleted_at = now() WHERE id = $1", [req.params.id]);
  await publishEvent(makeEvent("profile.purged", "profile-service", { profileId: req.params.id, reason: "citizen_request" }));

  res.json({ success: true, message: "Todos tus datos de sesión y consentimientos han sido eliminados de forma definitiva." });
});

// Eliminar perfil
app.delete("/api/v1/profiles/:id", async (req, res) => {
  if (!profiles.delete(req.params.id)) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Perfil no encontrado." } });
  void query("UPDATE profiles.citizen_profiles SET deleted_at = now() WHERE id = $1", [req.params.id]);
  await publishEvent(makeEvent("profile.deleted", "profile-service", { profileId: req.params.id }));
  res.status(204).send();
});

// Listar consentimientos
app.get("/api/v1/profiles/:id/consents", (req, res) => {
  const profile = profiles.get(req.params.id);
  if (!profile) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Perfil no encontrado." } });
  res.json({ consents: profile.consents });
});

// Otorgar o actualizar consentimiento
app.post("/api/v1/profiles/:id/consents", (req, res) => {
  let profile = profiles.get(req.params.id);
  if (!profile) {
    profile = {
      id: req.params.id,
      anonymous: true,
      preferences: {},
      consents: []
    };
    profiles.set(profile.id, profile);
  }

  const parsed = consentInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Consentimiento inválido." } });

  const existingConsentIndex = profile.consents.findIndex((c) => c.purpose === parsed.data.purpose);
  let consent: Consent;

  if (existingConsentIndex >= 0) {
    consent = {
      ...profile.consents[existingConsentIndex],
      granted: parsed.data.granted,
      revokedAt: parsed.data.granted ? undefined : new Date().toISOString()
    };
    profile.consents[existingConsentIndex] = consent;
  } else {
    consent = {
      id: randomUUID(),
      purpose: parsed.data.purpose,
      version: parsed.data.version,
      granted: parsed.data.granted,
      createdAt: new Date().toISOString()
    };
    profile.consents.push(consent);
  }

  void publishEvent(
    makeEvent(consent.granted ? "consent.granted" : "consent.revoked", "profile-service", {
      profileId: profile.id,
      consentId: consent.id,
      purpose: consent.purpose
    })
  );

  res.status(201).json(consent);
});

// Revocar consentimiento específico
app.delete("/api/v1/profiles/:id/consents/:consentId", async (req, res) => {
  const profile = profiles.get(req.params.id);
  const consent = profile?.consents.find((item) => item.id === req.params.consentId || item.purpose === req.params.consentId);
  if (!consent) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Consentimiento no encontrado." } });

  consent.granted = false;
  consent.revokedAt = new Date().toISOString();
  await publishEvent(makeEvent("consent.revoked", "profile-service", { profileId: profile?.id, consentId: consent.id, purpose: consent.purpose }));
  res.status(204).send();
});

if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3002);
  const server = app.listen(port, () => logger.info({ port }, "profile-service listening"));
  const shutdown = () => server.close(() => process.exit(0));
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
