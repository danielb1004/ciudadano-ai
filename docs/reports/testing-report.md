# Pruebas de la implementación

Fecha: 7 de octubre de 2026, America/Bogota. Entorno: Windows, Node 24.12.0, Python 3.12, Chromium de Playwright. Cambios locales sin commit de entrega aún.

## Resultados observados

| Comprobación | Resultado |
|---|---|
| Backend Vitest | 56 pruebas aprobadas |
| Frontend Vitest sobre App real | 6 pruebas aprobadas |
| Python pytest | 9 pruebas aprobadas |
| Navegador Playwright | 8 pruebas aprobadas |
| Compilación TypeScript/Vite | Comprobada; ver registro build.log |
| npm audit / pip-audit | Sin vulnerabilidades conocidas reportadas en dependencias instaladas |

Backend: sentencias **83,91%**, líneas **93,64%**, funciones **83,75%**, ramas **71,87%**. Umbral de CI: ≥80% en sentencias/líneas/funciones del alcance instrumentado. Las ramas siguen por debajo de 80% y se informan sin ocultarlas.

Alcance instrumentado: entradas de los servicios Node y bibliotecas security/store/http/events. No es cobertura global del frontend, Python o todo el repositorio. Los adaptadores PostgreSQL/Kafka se comprueban con dobles controlados, no servidores distribuidos reales.

## Flujos cubiertos

- CP01–14 del Word: orientación, español, confianza, aclaración/derivación, contexto, anonimización, consentimiento, OTP, bloqueo, caída institucional, feedback, expiración y exportación.
- Acceso cruzado de ciudadanos, estado de solicitud propia, revocación, purga conjunta, renovación por cookie, rotación refresh y concurrencia OTP.
- Catálogo/versiones/administración, métricas y cadena de auditoría.
- Cola de eventos: entrega, retención durante fallo, reintentos y DLQ.
- Cifrado, autenticación de mensajes cifrados y transacciones en el adaptador PostgreSQL.
- En navegador real: consentimiento → consulta → seguimiento → exportación → eliminación, OTP/estado simulado, diálogo por teclado a 1920 px y cinco pantallas sin desbordamiento a 320 px.
- Axe: sin violaciones reportadas para WCAG A/AA/2.1 AA en las cinco pantallas iniciales revisadas. No equivale a auditoría manual o certificación.

## Evidencia generada localmente

research/evidence/node-tests.log, coverage/coverage-summary.json, browser-results.json, browser-tests.log, build.log y python-audit.json. Los archivos generados quedan fuera de Git; este reporte resume sus resultados. Los tests se reproducen mediante README y CI.

Preparación de corpus demostrativo: 100 textos únicos, particiones 70/15/15, academic=false. BETO --prepare-only comprobado: configuración preparada, sin entrenamiento ni métricas. Evaluador HTTP comprobado sobre 15 muestras de test de demostración; academic=false y sin atribuir esos resultados a BETO.

## Pendiente

Corpus académico y checkpoint BETO; calidad/calibración del modelo; SUS con participantes; JMeter distribuido/monitoreo; ZAP autenticado; Docker/Kubernetes y servicios gestionados, TLS, backups y SLA. Los números originales de 214/46/84%, F1, SUS y latencia del Word no se atribuyen a esta ejecución.
