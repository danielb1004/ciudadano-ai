# Ciudadano AI

Prototipo académico de orientación sobre trámites colombianos, ajustado a los requisitos del documento **proyecto_final_V3_5_UMB_final.docx**. La matriz [Word → implementación](docs/reports/word-alignment.md) distingue funciones, controles y resultados pendientes.

## Inicio local (PowerShell)

Requisitos: Node.js 24, Python 3.12 y npm. Desde esta carpeta:

```powershell
npm.cmd ci
npm.cmd run setup
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r services/nlp-service/requirements.txt
npm.cmd run dev
```

Abrir http://localhost:5173. En este equipo ya se preparó el entorno virtual. El comando setup genera secretos locales y conserva la configuración existente. .env queda fuera de Git.

El modo local utiliza memoria, reglas de demostración para PLN y seguimiento simulado. Los datos se pierden al reiniciar los procesos. Para PostgreSQL, Redis, Kafka y Kong:

```powershell
docker compose up --build -d
```

Docker expone frontend en 5173 y Kong en 8000. No ejecutar simultáneamente ambas modalidades sobre los mismos puertos. El Compose es un entorno académico; los manifiestos de producción requieren configuración y secretos reales.

## Funciones disponibles

- Perfil anónimo con JWT de 15 minutos y renovación mediante cookie HttpOnly; consentimiento explícito antes del chat.
- Consultas de hasta 500 caracteres, anonimización previa al PLN, seguimiento de contexto y aclaración por confianza inferior a 0,70.
- Catálogo independiente, hasta tres recomendaciones, requisitos, costo/plazo referenciados, fuentes oficiales y advertencia de antigüedad.
- OTP de cinco minutos, tres intentos y bloqueo de cinco minutos; seguimiento solo de solicitudes propias.
- Reporte de respuestas, versionado y desactivación de fichas, métricas reales y auditoría con cadena SHA-256/HMAC.
- Exportación conjunta de perfil, consentimiento, sesiones y feedback; purga y vencimiento de sesiones por 15 minutos de inactividad.

En el seguimiento de demostración usar **ciudadano-demo@example.test**, el código mostrado en pantalla y el radicado **DEMO-001**. No se envía correo en este modo. El administrador local es admin@ciudadano.gov.co; contraseña definida en DEFAULT_ADMIN_PASSWORD de .env. La contraseña predeterminada es solo de desarrollo.

## Seis servicios

| Servicio del Word | Implementación | Puerto |
|---|---|---|
| ms-chat | services/conversation-service | 3001 |
| ms-pln | services/nlp-service, FastAPI | 8001 |
| ms-catalogo | services/catalog-service | 3002 |
| ms-auth | services/auth-service; incluye la biblioteca profile-service | 3004 |
| ms-recomendacion | services/recommendation-service | 3003 |
| ms-auditoria | services/audit-service | 3005 |

## Verificación reproducible

```powershell
npm.cmd run build
npm.cmd test
.venv/Scripts/python.exe -m pip install -r testing/requirements.txt
.venv/Scripts/python.exe -m pytest services/nlp-service/tests ml/testing -q
npx.cmd playwright install chromium
# Con npm run dev activo:
npx.cmd playwright test
```

Resultados de esta implementación: [reporte de pruebas](docs/reports/testing-report.md). CI compila por servicio y ejecuta integración, Python y navegador; no publica automáticamente.

## Evidencia pendiente

El usuario confirmó que no dispone del corpus original de **2.340 muestras** ni de los registros **SUS, JMeter y ZAP**. No se atribuyen al software las cifras académicas del Word. BETO tiene entrenamiento e inferencia reales implementados, pero no existe un checkpoint entrenado. En producción la falta del checkpoint deja PLN no disponible; no se reemplaza silenciosamente por reglas.

Los datos incluidos son de demostración. Las tarifas, plazos, horarios y vigencia de las fichas deben revisarse en sus fuentes; no se inventaron valores. Las integraciones OTP/API institucional, disponibilidad, TLS, infraestructura distribuida y evaluación con participantes necesitan ejecutarse en sus entornos correspondientes.

## Documentación

[Instalación](docs/manuals/installation.md) · [Uso](docs/manuals/user.md) · [Administración](docs/manuals/admin.md) · [Entrenamiento](docs/manuals/training.md) · [Evaluación](docs/manuals/evaluation.md) · [Despliegue](docs/manuals/deployment.md) · [Arquitectura](docs/architecture/README.md) · [OpenAPI](docs/api/openapi.yaml)

## Corpus sintético

Por petición del usuario, se generó ml/datasets/synthetic-v1.csv: 2.340 consultas sintéticas, 468 por intención. Las familias se separan entre entrenamiento, validación y prueba. Baseline y BETO están entrenados con esos datos. BETO FP32 obtuvo F1 macro 0,8836; está instalado en Kubernetes en AWS, publicado en [Ciudadano AI](https://ciudadano-ai.3-142-230-27.sslip.io) con HTTPS y TLS 1.3 verificados. Detalle y métricas: [informe del corpus](ml/datasets/synthetic-corpus-report.md). Este material no reemplaza los registros reales ni las evaluaciones con participantes que afirma el Word.

Despliegue AWS: [estado y evidencia](docs/reports/aws-deployment.md).
