# ms-chat

Orquesta consentimiento/titularidad, anonimización, PLN, aclaración, recomendaciones, contexto y derivación. Flujo de estados explícito con circuit breakers y timeouts. PostgreSQL autoritativo, Redis como caché cifrada, TTL de sesión 900 segundos y feedback vinculado a messageId.

Las rutas están en docs/api/openapi.yaml. Los eventos se almacenan en outbox y se envían aparte de la petición cuando hay Kafka; en desarrollo se entregan al auditor por HTTP interno.
