# Arquitectura

Ciudadano AI usa Kong como único punto público. La conversación es síncrona hacia PLN, perfilamiento y recomendaciones; los eventos se publican en Kafka para auditoría y proyecciones. Cada servicio es dueño de su esquema PostgreSQL. Redis mantiene contexto corto con TTL de 15 minutos; Kafka conserva eventos según la política de retención del ambiente.

## ADR-001: microservicios y eventos

- **Decisión:** seis servicios independientes, REST para consultas inmediatas y Kafka para hechos de negocio.
- **Razón:** separar ciclos de despliegue y responsabilidades; permitir reintentos, auditoría y proyecciones CQRS.
- **Consecuencia:** se requiere observabilidad, contratos versionados, idempotencia y DLQ. El MVP usa adaptadores en memoria cuando no hay dependencias locales, pero el camino de producción es PostgreSQL/Redis/Kafka.

## Patrones

Los comandos (`POST/PATCH/DELETE`) y consultas (`GET`) tienen modelos y rutas separados. Los eventos inmutables de conversación, consentimiento y seguridad forman la bitácora de Event Sourcing; una proyección puede reconstruir el estado. Los consumidores deben deduplicar por `eventId`, reintentar con backoff y enviar al tópico `*.DLQ` tras el máximo configurado. Las llamadas síncronas tienen timeout y `CircuitBreaker` con estados CLOSED/OPEN/HALF_OPEN.
