# Correspondencia con el Word

Fuente de requisitos: proyecto_final_V3_5_UMB_final.docx, proporcionado por el usuario. Las afirmaciones de resultados del documento se trataron como referencias a contrastar. El usuario confirmó que no tiene corpus ni registros originales. El Word original permanece sin modificaciones.

**Implementado** indica código disponible y comprobación local donde se menciona. **Pendiente** indica evidencia o configuración necesaria; no significa un resultado aprobado.

## Requisitos funcionales

| ID | Requisito | Implementación y estado |
|---|---|---|
| RF01 | Sesión anónima e identificador | UUID del servidor; perfil sin datos de identidad. Implementado. |
| RF02 | Consentimiento previo | Bloqueo en interfaz y API, decisiones versionadas por finalidad. Implementado. |
| RF03 | Lenguaje natural, español, 500 caracteres | Validación cliente/servidor y expresiones colombianas. Implementado; calidad poblacional pendiente. |
| RF04 | Anonimización previa a PLN | Correos, documentos numéricos y teléfonos, incluidos separadores. CP06. Implementado; no equivale a anonimizar toda información personal posible. |
| RF05 | Cinco intenciones y confianza | Reglas de demostración, baseline y BETO real seleccionables. Pipeline implementado; corpus sintético de 2.340 consultas y baseline entrenada disponibles. BETO entrenado en corpus sintético: F1 macro 0,8836. Corpus real pendiente. |
| RF06 | Entidades de trámite, entidad, documento y ciudad | Extractor explícito en PLN. Implementado; exactitud con corpus real pendiente. |
| RF07 | Confianza <0,70; dos aclaraciones y derivación | Opciones y contador por sesión; CP03–04. Implementado. |
| RF08 | Requisitos, costo, tiempo, canal, fuente y fecha | Fichas estructuradas. Implementado; tarifas/plazos/horarios originales no disponibles, se remite a la fuente. Revisión editorial pendiente. |
| RF09 | Preguntas sucesivas sin repetir trámite | Trámite seleccionado y contexto para seguimiento; CP05. Implementado. |
| RF10 | Hasta tres recomendaciones | Ranking del catálogo publicado. Implementado. |
| RF11 | OTP 5 min, 3 intentos, bloqueo 5 min | Código de un uso, huella HMAC, consumo atómico, proveedor configurable. Mock local comprobado; proveedor real pendiente. |
| RF12 | Estado de solicitud propia, acceso 15 min | JWT citizen, verificación de consentimiento/titularidad, rechazo de estado parcial. Simulación explícita comprobada; integración institucional pendiente, acorde al límite declarado por el Word. |
| RF13 | Derivación con entidad, canal, horario y URL | Respuestas con datos del catálogo o GOV.CO. Implementado; horarios exactos requieren revisión de ficha. |
| RF14 | Aviso de alcance | Orienta y no reemplaza canales oficiales. Implementado. |
| RF15 | Eventos con fecha, productor e integridad | Cadena SHA-256/HMAC, datos minimizados; outbox cifrado y Kafka asíncrono con reintentos/DLQ. Código y adaptadores comprobados; broker real pendiente. |
| RF16 | Feedback asociado al mensaje | messageId real, comentario anonimizado, revisión administrativa previa a ampliar corpus. Implementado. |
| RF17 | Administración y versiones de catálogo | Crear, actualizar, desactivar sin perder versiones; permisos administrativos. Implementado. |
| RF18 | Sesiones, intenciones, derivación y latencia | Contadores derivados de actividad real. Implementado; no son benchmarks académicos. |
| RF19 | Consulta, exportación y purga con comprobante | Perfil, historial de consentimientos, sesiones y reportes; recibos UUID. Implementado, incluido recorrido real del navegador. Auditoría mínima conserva huellas según política técnica. |
| RF20 | Vencimiento por 15 min sin actividad | TTL autoritativo, caché y limpieza; CP13. Implementado. |

## Requisitos no funcionales

| ID | Criterio del Word | Estado y evidencia necesaria |
|---|---|---|
| RNF01 | Respuesta media <800 ms con 500 usuarios | JMeter tiene solicitudes, consentimiento, tokens y conversaciones reales. Ejecución distribuida y resultados pendientes. |
| RNF02 | Inferencia PLN <300 ms | Evaluador mide tiempo interno y latencia HTTP. Benchmark BETO con checkpoint/hardware real pendiente. |
| RNF03 | Disponibilidad ≥99,5% | Probes y réplicas configurados; medición operativa prolongada pendiente. |
| RNF04 | Degradación y resiliencia | Circuit breakers, derivación ante PLN caído y caché de catálogo con aviso. Comprobación local parcial; fallos de infraestructura pendientes. |
| RNF05 | Escalamiento al 70% de CPU | HPA de seis servicios. Requiere clúster y metrics-server; no ejecutado aquí. |
| RNF06 | TLS 1.3 y AES-256 | AES-256-GCM en datos PostgreSQL y contexto Redis; claves de 32 bytes. Ingress/certificado y restricción TLS requieren operación real. |
| RNF07 | JWT 15 min, límite 60/IP/min | JWT de acceso profile/citizen/admin de 15 min; credencial de renovación separada. Límite de API y Kong/Redis; proxies privados controlados y política de red configurables. |
| RNF08 | Sin vulnerabilidades CVSS >7 | pip-audit sin vulnerabilidades conocidas en la imagen PLN actualizada; auditoría npm previa disponible. ZAP pasivo sin alertas altas. Escaneo activo, sistema operativo, todas las imágenes y entorno histórico de entrenamiento pendientes; no acredita el criterio completo. |
| RNF09 | Retención anónima 30 días | TTL de perfiles/feedback, purga y limpieza. Auditoría de metadatos: política distinta documentada. Operación de backups pendiente. |
| RNF10 | SUS ≥68 | Formulario, consentimiento y analizador validado; participantes/resultados pendientes. |
| RNF11 | WCAG 2.1 AA | Controles, etiquetas, contraste, teclado y revisión axe en cinco pantallas. Auditoría manual con lector de pantalla/zoom/usuarios pendiente; no certificada. |
| RNF12 | Cobertura ≥80% | Umbral de backend en sentencias/líneas/funciones; ramas se informan por separado. Ver reporte con alcance y cifras reales. Cobertura global frontend/PLN no equiparada a esta métrica. |
| RNF13 | CI por servicio | Workflow de compilación por workspace y trabajos de integración/PLN/navegador. Ejecución remota pendiente de push. |
| RNF14 | Portabilidad Kubernetes | Manifiestos, volúmenes, gateway, secretos externos y parche GPU preparados. Docker/Kubernetes no ejecutados en este equipo. |
| RNF15 | Responsive 320–1920 px | Revisión automática a 320 y pantallas de escritorio; revisar todos los flujos y dispositivos del estudio. |

## Resultados que no están comprobados

- 2.340 muestras consentidas y revisadas: ausentes.
- Fine-tuning BETO, F1 del documento y latencias sobre BETO: pendientes.
- SUS 61,2 / 73,8 con 28 / 52 participantes: no se dispone de registros.
- Media 743 ms a 500 usuarios: no se dispone de JTL ni monitoreo.
- 214 pruebas unitarias, 46 de integración y 84%: no se reutilizan como cifras del código actual.
- ZAP, disponibilidad, TLS y operación del clúster: requieren evidencia nueva.

Las herramientas preparan esas evaluaciones y rechazan datos vacíos o demostrativos como evidencia académica. Ningún cambio de software puede demostrar retrospectivamente los resultados ausentes.

## Material sintético solicitado posteriormente

Se generaron 2.340 consultas sintéticas con cinco intenciones y particiones por familia. La baseline se entrenó y obtuvo F1 macro 0,7406; BETO está entrenado y obtuvo F1 macro 0,8836 en prueba sintética. Este avance no cambia el estado de los resultados originales ausentes ni acredita SUS con personas reales. Ver ml/datasets/synthetic-corpus-report.md.

## Operación en AWS

Kubernetes y los servicios están instalados; seis HPA al 70% reciben métricas. BETO FP32 conserva F1 macro 0,8836 en 346 consultas sintéticas, con media de inferencia 68 ms en AWS. Ocho pruebas de navegador y siete de recuperación aprobadas por túnel SSH. JMeter inicial con cinco usuarios, no 500. HTTPS público activo con certificado válido de Let's Encrypt y TLS 1.3; flujo de chat y privacidad aprobado en la URL pública. Evaluaciones adicionales de tiempos y cantidad de usuarios aplazadas por indicación del usuario. Ver docs/reports/aws-deployment.md para límites de seguridad y pendientes académicos.
