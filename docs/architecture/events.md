# Eventos

Consultar docs/api/events.md. El estado autoritativo usa snapshots cifrados; los eventos forman una auditoría minimizada, no una réplica íntegra de conversaciones.

El outbox se persiste antes de aceptar su publicación. Kafka se entrega aparte de la respuesta HTTP; la auditoría deduplica IDs. Reintentos con backoff, DLQ después de tres fallos y conservación del original pendiente. La publicación y el cambio de estado usan transacciones distintas; una falla del outbox después de guardar estado genera 503 y exige reconciliación operativa. No se promete exactamente una entrega.

Retención configurable del auditor; base 365 días de metadatos, con ancla de cadena al retirar prefijos. Perfiles y feedback: 30 días; sesiones: 15 minutos sin actividad.
