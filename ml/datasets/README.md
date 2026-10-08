# Corpus

## Corpus sintético disponible

synthetic-v1.csv contiene **2.340 consultas generadas**, con 468 ejemplos por intención.
Incluye 100 familias de redacción, 15 tipos de trámite y referencias a 12 ciudades.
Cada fila declara source, is_synthetic=true, reviewer vacío y reviewStatus=not_human_reviewed.
Los nombres de ciudades no demuestran representatividad regional.

Generación reproducible y preparación:

```powershell
.venv/Scripts/python.exe ml/datasets/generate_synthetic.py
.venv/Scripts/python.exe ml/training/prepare_splits.py --data ml/datasets/synthetic-v1.csv --output-dir ml/datasets/synthetic-splits
```

Las familias completas se asignan a entrenamiento, validación o prueba, aproximadamente
70/15/15. Así, una plantilla no aparece en varias particiones. El vocabulario de trámites
y ciudades sí se comparte: las métricas reflejan generalización entre estas plantillas,
sin demostrar desempeño con ciudadanos reales. Se conservan los tamaños efectivos y hashes.

El material puede entrenar la baseline y BETO para un **prototipo con datos sintéticos**.
No acredita el corpus recopilado, el consentimiento, la revisión humana ni los resultados
empíricos que el Word afirma haber obtenido.

## Corpus académico

El corpus original de 2.340 consultas reales no está disponible.
--academic exige procedencia, consentimiento y revisión; rechaza filas declaradas sintéticas.
Registrar licencia, fuentes autorizadas, doble revisión, muestreo y análisis de sesgos.

demo.csv (10 textos) y corpus-v1.csv (100 filas) son demostraciones anteriores; se mantienen
para compatibilidad y no se presentan como datos recogidos de ciudadanos.
