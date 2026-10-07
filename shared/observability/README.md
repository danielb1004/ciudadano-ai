# Observabilidad

Todos los servicios emiten JSON con `serviceName`, método, ruta y `correlationId`; los campos sensibles están redactados. `/health`, `/ready` y `/metrics` son endpoints operativos. En producción conectar logs, métricas y trazas a un backend externo sin registrar texto ciudadano.
