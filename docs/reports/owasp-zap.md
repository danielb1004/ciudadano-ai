# Estado OWASP ZAP

Pendiente de ejecución en staging. El escaneo API usa docs/api/openapi.yaml desde disco, no una ruta /openapi.json inexistente. api-scan.sh usa modo pasivo; configurar contexto y JWT por rol para evaluación activa autenticada.

Guardar versión, fecha, commit, objetivo, JSON/HTML, permisos, alertas, severidad y corrección. npm/pip audit sin hallazgos no equivale a un ZAP aprobado. Objetivo del Word: sin vulnerabilidades con CVSS >7; validar también imágenes, configuración y dependencias de entrenamiento instaladas.
