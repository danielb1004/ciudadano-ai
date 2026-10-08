# Privacidad implementada

Perfil anónimo creado sin consentimiento del chat. El chat y OTP exigen finalidad conversation_context vigente; investigación y analítica tienen decisiones separadas. Cada decisión conserva UUID, finalidad, versión, fecha y revocación.

La consulta se anonimiza antes de PLN. Se conserva el texto anonimizado, no el original; no se garantiza detectar toda información personal expresada en lenguaje libre. La interfaz recomienda evitarla.

JWT de acceso 15 minutos. Credencial de renovación separada en cookie HttpOnly/SameSite; huellas de credenciales almacenadas. Sesiones: 15 minutos sin actividad; perfiles y feedback: 30 días. Limpieza y borrado incluyen sesiones, feedback, consentimientos y renovaciones. Exportación real y comprobantes disponibles.

PostgreSQL y contexto Redis cifrados AES-256-GCM con claves externas. La auditoría conserva metadatos mínimos y huellas, con retención propia de 365 días de base; no guarda consultas, correos, OTP ni contraseñas.

TLS, permisos de base, almacenamiento de backups, rotación de claves y borrado de copias requieren configuración/verificación operativa. No se afirma certificación legal o ISO.
