# Manual de evaluación

Ejecuta `python3 ml/evaluation/evaluate.py --data ml/datasets/demo.csv --output research/evidence/nlp-metrics.json`. El resultado incluye accuracy, precision/recall/F1 por clase, F1 macro/micro, matriz y tiempo. Para afirmaciones académicas reemplaza el demo por el corpus consentido de 2.000–2.340 muestras, registra commit/ambiente y conserva el JSON. El umbral F1 macro >= 0.70 es criterio, no una cifra garantizada.
