# Evaluación reproducible

## PLN

Utilizar las particiones guardadas durante entrenamiento:

```powershell
.venv/Scripts/python.exe ml/evaluation/evaluate.py --splits ml/datasets/splits --endpoint http://localhost:8001 --output research/evidence/nlp-evaluation.json
```

El evaluador rechaza fuga entre particiones, corpus no académico y reglas de demostración salvo --allow-demo explícito. Genera accuracy, precision/recall/F1, matriz y tiempos internos/HTTP. El hash del test, modelo y versión quedan registrados. Las pruebas automatizadas no evalúan calidad poblacional de PLN.

## SUS

Reclutar participantes y seguir testing/usability/protocol.md. Completar research/sus/form.csv con respuestas reales y consent=true:

```powershell
.venv/Scripts/python.exe research/sus/analyze_sus.py research/sus/form.csv --output research/evidence/sus-results.json
```

El formulario vacío no produce una media. Objetivo ≥68; no se reproducen las cifras del Word sin registros.

## Carga

Ejecutar JMeter 5.6.3 sobre un entorno de staging autorizado y distribuido:

```powershell
jmeter -n -t testing/jmeter/conversation-load.jmx -Jhost=localhost -Jport=8000 -Jusers=500 -Jramp=60 -Jmessages=-1 -Jduration=300 -l testing/jmeter/results.jtl
.venv/Scripts/python.exe testing/jmeter/analyze.py --jtl testing/jmeter/results.jtl
```

500 hilos desde una misma IP chocan con el límite de 60 solicitudes/minuto/IP. Distribuir los clientes en IP reales autorizadas y consolidar JTL. No desactivar el límite ni falsificar encabezados para aparentar un ensayo válido. Registrar concurrencia sostenida, errores, throughput, p50/p95/p99 y monitoreo de CPU/memoria. Configurar un arranque inicial aparte del tramo medido; los hilos configurados no demuestran simultaneidad.

## Seguridad y accesibilidad

npm audit y pip-audit revisan dependencias. testing/zap/api-scan.sh importa OpenAPI desde disco y usa modo pasivo; baseline.sh recorre la web. Ejecutar pruebas activas/autenticadas con contexto y cuentas de staging, incluyendo controles de titularidad y permisos. Los errores de ZAP no deben ocultarse.

npx playwright test revisa flujos y axe sobre cinco pantallas. Complementar con teclado, lector de pantalla, foco de diálogos, zoom, voz y usuarios reales. Conservar commit, ambiente, fecha y archivos originales para cada evaluación.
