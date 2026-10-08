# Entrenamiento BETO

Estado actual: sin corpus académico y sin checkpoint BETO. Las reglas locales se identifican como demostración.

1. Reunir consultas reales con autorización. Anonimizar antes de guardarlas, etiquetar cinco intenciones y revisar por dos personas.
2. CSV UTF-8: text,intent,source,consent,reviewer. Conservar consentimiento/procedencia fuera del texto. Se exige al menos 2.340 textos únicos para --academic.
3. Preparar particiones fijas y disjuntas, semilla 42, aproximadamente 70/15/15:

```powershell
.venv/Scripts/python.exe ml/training/prepare_splits.py --data ruta/corpus.csv --academic --output-dir ml/datasets/splits
.venv/Scripts/python.exe -m pip install -r ml/requirements-training.txt
.venv/Scripts/python.exe ml/training/train_baseline.py --splits ml/datasets/splits
.venv/Scripts/python.exe ml/training/train_beto.py --splits ml/datasets/splits --output-dir ml/models/beto-intents-v1
```

La comparación usa las mismas particiones. Se selecciona C de la baseline sobre validación; BETO usa AdamW, tasa 2e-5, early stopping y selección por F1 macro de validación. El test se evalúa después de seleccionar el modelo. --prepare-only escribe configuración sin descargar pesos, entrenar ni generar métricas.

Preprocesamiento compartido entre entrenamiento e inferencia. BETO guarda tokenizer, etiquetas, pesos y test-metrics.json. El servicio carga solo archivos locales, verifica las cinco etiquetas y usa GPU cuando está disponible. Definir NLP_BACKEND=beto y BETO_MODEL_PATH; reiniciar el servicio.

El corpus incluido sirve para diagnóstico técnico. No duplicarlo ni generar ejemplos artificiales para aparentar 2.340 registros reales. Revisar sesgo, representatividad, errores de etiqueta y procedencia; --academic valida campos, no autentica el consentimiento por sí mismo.

## Entrenamiento con el corpus sintético solicitado

Ya existen 2.340 consultas sintéticas; la baseline se entrenó y BETO tiene configuración preparada.
Las familias de plantilla se mantienen juntas para evitar repetición entre particiones.

```powershell
.venv/Scripts/python.exe ml/datasets/generate_synthetic.py
.venv/Scripts/python.exe ml/training/prepare_splits.py --data ml/datasets/synthetic-v1.csv --output-dir ml/datasets/synthetic-splits
.venv/Scripts/python.exe ml/training/train_baseline.py --splits ml/datasets/synthetic-splits --output ml/models/baseline-synthetic-v1.joblib --metrics ml/evaluation/synthetic-baseline-metrics.json
.venv/Scripts/python.exe -m pip install -r ml/requirements-training.txt
.venv/Scripts/python.exe ml/training/train_beto.py --splits ml/datasets/synthetic-splits --output-dir ml/models/beto-synthetic-v1
```

Todos los resultados se registran como academic=false. Para probar esa baseline en el servicio,
configurar NLP_BACKEND=baseline y BASELINE_MODEL_PATH con la ruta del archivo
ml/models/baseline-synthetic-v1.joblib, y reiniciar PLN. No se ha cambiado la configuración del
servidor actual. BETO requiere ejecutar el entrenamiento completo antes de seleccionarlo.
