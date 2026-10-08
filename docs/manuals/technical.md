# Manual técnico

Consultar docs/architecture/README.md y OpenAPI. Node/Express/TypeScript para cinco servicios y FastAPI para PLN; profile-service es biblioteca de auth. Store cifra AES-256-GCM cuando está configurado y requiere clave en producción; PostgreSQL parametrizado, TTL y mutaciones bloqueadas. Redis es caché cifrada; Kafka consume outbox.

JWT profile/citizen/admin duran 900 segundos. Renovación anónima por cookie HttpOnly/SameSite y perfil vigente; refresh administrativo rota y puede revocarse. Renovaciones se guardan mediante huellas y se eliminan con el perfil. El token citizen verifica titularidad y consentimiento en consulta de estado.

Node expone /health, /ready y /metrics. Readiness comprueba PostgreSQL/Redis configurados; PLN verifica su modelo. La disponibilidad del broker se supervisa por outbox/consumidor, no por una afirmación de SLA. Logs no incluyen consultas, credenciales ni caminos con datos sensibles.

Las pruebas de PostgreSQL/Kafka usan adaptadores controlados. El modo local de desarrollo tiene memoria y auditoría HTTP; no equivale a comprobar infraestructura distribuida. La capa de datos guarda snapshots; no hay reconstrucción de toda la aplicación desde eventos.
