# Contratos e integración

Usar `docs/api/openapi.yaml` como contrato público y `shared/event-schemas/event-envelope.schema.json` para Kafka. Los contract tests deben validar códigos, cuerpos de error con `correlationId`, límites de entrada y compatibilidad de versiones contra cada servicio levantado en Compose.
