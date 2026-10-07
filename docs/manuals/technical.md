# Manual técnico

Cada servicio expone `/health`, `/ready`, `/metrics` y `/api/v1`. Kong es la frontera pública. Node usa Express/TypeScript; PLN usa FastAPI/Pydantic y puede cargar BETO bajo demanda; eventos tienen sobre JSON Schema 1.0, correlación, idempotencia y DLQ. PostgreSQL usa schemas por servicio, Redis TTL para contexto y Kafka para hechos. Operar con logs estructurados redactados, migraciones versionadas y graceful shutdown.
