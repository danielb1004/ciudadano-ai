# Arquitectura implementada

Seis procesos: conversación, PLN, catálogo, autenticación, recomendación y auditoría. Profile-service es una biblioteca de autenticación, no un séptimo proceso. Kong mantiene /api/v1 sin eliminar el prefijo; /internal queda fuera del gateway.

El chat comprueba consentimiento y titularidad, anonimiza antes de PLN y consulta recomendaciones. Recomendación consulta el catálogo separado y puede devolver caché con fecha de sincronización. PLN admite BETO, baseline o reglas explícitas; producción exige checkpoint para BETO.

PostgreSQL es la fuente de estado mediante tablas app_state por esquema, con JSON cifrado AES-256-GCM, expiración y transacciones/bloqueos por agregado. Los esquemas conservan nombres internos (profiles dentro de ms-auth). Redis es caché cifrada de contexto con TTL. El modo local usa memoria y pierde estado al reiniciar.

Los eventos se guardan en un outbox del esquema del productor y se entregan asíncronamente a Kafka. Tras tres fallos se intenta DLQ, conservando el original para recuperación. El consumidor de auditoría deduplica eventId y encadena los metadatos minimizados con SHA-256 y HMAC. El modo local utiliza entrega HTTP interna al auditor.

La auditoría demuestra integridad relativa a las claves/almacenamiento; no es un almacenamiento WORM ni impide alteraciones por un administrador de infraestructura con todas las claves. Los estados se guardan como snapshots; no se afirma reconstrucción completa mediante Event Sourcing ni CQRS distribuido.

Timeouts y circuit breakers aíslan PLN/recomendaciones. Probes consultan dependencias configuradas; HPA usa CPU al 70%. Versionar imágenes por commit y operar bases/backups/secretos fuera del código.
