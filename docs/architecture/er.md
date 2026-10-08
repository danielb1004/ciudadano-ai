# Modelo lógico

```mermaid
erDiagram
  PROFILE ||--o{ CONSENT : registra
  PROFILE ||--o{ CONVERSATION : posee
  CONVERSATION ||--o{ MESSAGE : contiene
  MESSAGE ||--o{ FEEDBACK : recibe
  PROCEDURE ||--o{ PROCEDURE_VERSION : conserva
  CONVERSATION ||--o{ AUDIT_EVENT : emite
  PROFILE { string uuid boolean anonymous }
  CONSENT { string uuid string purpose string version boolean granted string createdAt }
  MESSAGE { string uuid string role string anonymizedContent }
  FEEDBACK { string messageId string rating string anonymizedComment }
  PROCEDURE { string id string title boolean published string verifiedAt }
  AUDIT_EVENT { string eventId string hash string previousHash string signature }
```

Persistencia física: tablas app_state(namespace,key,data,expires_at), JSON cifrado por agregado y claves de renovación representadas por huellas. No se conserva el texto original de la consulta.
