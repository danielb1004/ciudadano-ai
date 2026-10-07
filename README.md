# Ciudadano AI

Sistema conversacional inteligente para orientar trámites y servicios públicos en Colombia. El producto orienta y deriva hacia canales oficiales; no reemplaza a las entidades ni ejecuta trámites institucionales sin integración autorizada.

## Inicio rápido

```bash
cp .env.example .env
npm install
npm run dev
```

Para levantar dependencias locales (PostgreSQL, Redis, Kafka y Kong):

```bash
docker compose up -d
```

El frontend queda en `http://localhost:5173` y Kong expone `http://localhost:8000`. Cada servicio también puede ejecutarse de forma independiente con `npm --workspace services/<servicio> run dev`.

## Estructura

| Área | Contenido |
| --- | --- |
| `frontend` | React + Vite + TypeScript + Tailwind, interfaz ciudadana y panel administrativo |
| `services` | conversation, nlp, profile, recommendation, auth y audit |
| `shared` | contratos HTTP, eventos versionados, observabilidad y resiliencia |
| `ml` | corpus demostrativo, etiquetado, líneas base, BETO y evaluación reproducible |
| `infrastructure` | Docker Compose, Kong, PostgreSQL, Kafka, Redis, Kubernetes y TLS |
| `testing` | integración, E2E, JMeter, ZAP, resiliencia y usabilidad |
| `research` | SUS, estadística, riesgos, controles y matriz ISO 25010 |
| `docs` | arquitectura, manuales, API, catálogo de eventos y reportes |

## Verificación

```bash
npm test
python3 -m pytest ml/testing -q
python3 ml/evaluation/evaluate.py --data ml/datasets/demo.csv --output research/evidence/nlp-metrics.json
```

Las cifras de evaluación no están precargadas: se calculan al ejecutar los comandos. El corpus incluido es demostrativo y no permite afirmar resultados académicos sobre 2.340 muestras reales. Consulte [docs/manuals/evaluation.md](docs/manuals/evaluation.md) para el protocolo completo.

## Seguridad y privacidad

La aplicación anonimiza el texto antes de enviarlo al PLN, valida entradas, aplica límites de tasa, JWT para administración, consentimiento granular, eliminación y descarga de datos, logs estructurados sin texto sensible y fuentes oficiales verificadas. TLS 1.3, secretos del proveedor, firewall, backups y operación de ZAP son controles de infraestructura/despliegue y deben configurarse en cada ambiente.

## Documentación principal

- [Arquitectura y ADR](docs/architecture/README.md)
- [Contratos OpenAPI](docs/api/openapi.yaml)
- [Catálogo Kafka](docs/api/events.md)
- [Despliegue](docs/manuals/deployment.md)
- [Entrenamiento y evaluación](docs/manuals/evaluation.md)
- [Privacy by Design](docs/reports/privacy-by-design.md)
- [Matriz ISO 27001](docs/reports/iso-27001.md)
- [Matriz ISO 25010](docs/reports/iso-25010.md)

