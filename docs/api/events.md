# Catálogo de eventos Kafka

Todos los eventos usan `eventVersion: "1.0"`, UUIDs y `occurredAt` ISO-8601. `payload` se valida antes de publicar. El `eventId` es la clave de idempotencia; los fallos se reintentan con backoff y pasan a `<topic>.DLQ`.

| Evento | Productor | Payload mínimo |
|---|---|---|
| `conversation.message.received` | conversation | messageLength |
| `conversation.intent.classified` | conversation | intent, confidence |
| `profile.created/updated/deleted` | profile | profileId |
| `consent.granted/revoked` | profile | profileId, consentId, purpose |
| `recommendation.generated` | recommendation | count, intent |
| `security.user.authenticated` | auth | adminId |
| `security.access.failed` | auth | emailHash |
| `audit.service.started` | audit | {} |

