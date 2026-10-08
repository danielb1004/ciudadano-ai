# Administración

Ingresar con cuenta autorizada. La contraseña local está en DEFAULT_ADMIN_PASSWORD de .env; producción no crea una contraseña predeterminada.

Permisos: catalog_read, catalog_write, audit_read, ml_manage y users_manage. El API comprueba permisos y el titular de datos ciudadanos independientemente del administrador.

Catálogo: crear ficha, añadir requisitos, pasos, canales, fuentes HTTPS .gov.co, fecha revisada, costo, tiempo y horario. Actualizar crea nueva versión; desactivar conserva el historial. No marcar una fuente como revisada sin comprobarla.

Tablero muestra eventos, sesiones, distribución de intenciones, derivación, latencia y modelo activo. Métricas PLN solo aparecen cuando hay archivos de evaluación; Pendiente no significa cero errores. Audit permite comprobar cadena y firma.

Feedback: GET /api/v1/conversations/feedback/review, permiso ml_manage, para revisión humana antes de incorporar consultas al corpus. Administración de usuarios: rutas auth/admins, users_manage.

Las estadísticas locales y el modo de reglas no prueban cifras académicas. Consultar la matriz del Word y registrar evidencia nueva para entrenamiento, SUS, carga y seguridad.
