# Despliegue académico en AWS

## Estado

Servidor autorizado por el usuario: 3.142.230.27, usuario ubuntu, Ubuntu 26.04 LTS, x86_64, aproximadamente 8 GB de RAM y disco de 50 GB. Kubernetes K3s v1.36.5+k3s1 instalado. No se han creado servidores adicionales ni contratado servicios gestionados.

Los seis servicios, frontend, Kong, PostgreSQL, Redis, Kafka y Caddy están disponibles dentro del clúster. PostgreSQL, Redis, Kafka y certificados tienen volúmenes persistentes en el nodo. El modelo se monta de forma local y de solo lectura.

Dominio temporal: https://ciudadano-ai.3-142-230-27.sslip.io

**Publicado:** Caddy obtuvo un certificado válido de Let's Encrypt. Se verificaron TLS 1.3, rechazo de TLS 1.2, redirección HTTP a HTTPS y respuesta 200 de las pantallas públicas. El flujo de consentimiento, consulta, seguimiento, exportación y eliminación pasó en un navegador contra la URL pública, sin túnel SSH.

El usuario priorizó completar el despliegue; las evaluaciones adicionales de tiempos y cantidad de usuarios quedan para después. El dominio temporal depende de la IP pública actual; si cambia, se debe actualizar el dominio y la configuración de Caddy.

## Evidencia obtenida

| Comprobación | Resultado |
|---|---|
| Backend | 56 pruebas aprobadas |
| Frontend unitario | 6 pruebas aprobadas |
| Python | 9 pruebas aprobadas |
| Navegador contra AWS mediante SSH | 8 pruebas aprobadas |
| Navegador contra HTTPS público | Flujo de chat, seguimiento y privacidad aprobado |
| HTTPS público | Certificado válido de Let's Encrypt, TLS 1.3 y HSTS |
| Persistencia y recuperación | 7 comprobaciones aprobadas |
| BETO en 346 consultas sintéticas | F1 macro 0,8836; media 68 ms; p95 89 ms |
| JMeter inicial | 5 usuarios virtuales, 10 mensajes, cero errores; media 273,1 ms, p95 346 ms |
| HPA | Seis servicios, objetivo CPU 70%; PLN subió de 1 a 3 réplicas y volvió a 1 |
| Dependencias Python de la imagen PLN actualizada | Sin vulnerabilidades conocidas en pip-audit |
| ZAP pasivo, versión 2.17.0 | Cero alertas altas; observaciones medias, bajas e informativas |

Las pruebas iniciales de navegador y JMeter recorrieron el sistema mediante un túnel SSH privado. La comprobación final del flujo ciudadano se ejecutó contra HTTPS público. Estas ejecuciones no acreditan la evaluación distribuida de 500 usuarios.

ZAP observó CSS inline permitido, integridad de recursos externos ausente y versión de nginx en el acceso directo al frontend. El análisis fue pasivo. La revisión activa autenticada y el análisis de vulnerabilidades del sistema operativo y de todas las imágenes siguen pendientes. La auditoría del contenedor de PLN no acredita la seguridad de todo el sistema.

## Correcciones durante el arranque

- Permisos locales de la llave SSH restringidos al usuario propietario.
- Espera de PostgreSQL antes de iniciar servicios Node.
- Controlador Kafka accesible por loopback para evitar depender de su propia disponibilidad; reinicio con estrategia Recreate sobre el volumen persistente.
- Esquema recommendation.app_state agregado mediante migración idempotente, conservando los datos.
- Pantalla de privacidad espera al perfil y resuelve el identificador antes de exportar.
- Runtime FP32 conserva la precisión; INT8 rechazado por su evaluación.
- pip actualizado en la imagen PLN.
- Secret de Kubernetes contiene únicamente claves y contraseñas; la configuración del modelo permanece en ConfigMap.

## Límites y pendientes

Un único nodo no tolera la pérdida del servidor. Los volúmenes locales necesitan un procedimiento y prueba de respaldo externo. Las comunicaciones internas no se han certificado como TLS extremo a extremo.

OTP y consulta de estados son simulaciones rotuladas del prototipo académico. El corpus es sintético. SUS necesita participantes reales. Disponibilidad del 99,5%, 500 usuarios y ausencia de vulnerabilidades CVSS >7 no están acreditadas.

El origen de cada prueba, su configuración y resultados se conserva en research/evidence/aws-*. La revisión automática rechazó copiar .env.cloud al equipo local; no se copiaron secretos. Las claves del despliegue siguen en el servidor y no deben regenerarse al actualizar datos cifrados.
