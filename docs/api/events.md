# Eventos implementados

Sobre 1.0: eventId, eventType, occurredAt, correlationId, producer, payload y conversationId opcional. UUIDs y payload se validan. Los tópicos reemplazan puntos por guiones; DLQ añade .DLQ.

| Familia | Productor | Metadatos |
|---|---|---|
| conversation.started / intent.classified / feedback.submitted / deleted | conversation-service | ID de perfil/sesión, intención, confianza, derivación, ID de feedback |
| profile.created / updated / exported / purged | auth-service | ID anónimo, comprobante |
| consent.granted / revoked | auth-service | ID, propósito y decisión vinculada |
| procedure.created / updated / deactivated | catalog-service | ID de ficha y versión |
| request.status.accessed / unavailable | catalog-service | ID anónimo y modalidad |
| security.otp.requested / failed / citizen.authenticated | auth-service | ID anónimo |
| security.user.authenticated / access.failed | auth-service | ID administrativo o huella, contador de fallos |
| security.request.denied | catalog-service | ID anónimo |
| audit.service.started | audit-service | Ambiente |

Nunca enviar texto de consulta, código OTP, contacto, contraseña o tokens en eventos. El auditor elimina recursivamente esos campos antes de sellar. Los IDs se usan para trazabilidad técnica; la auditoría tiene retención propia y permisos audit_read.
