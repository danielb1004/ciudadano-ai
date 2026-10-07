# Model card — BETO intents v1

Base prevista: `dccuchile/bert-base-spanish-wwm-cased`, fine-tuning de cinco intenciones. La imagen actual registra el contrato y el punto de entrada de entrenamiento, pero no contiene un checkpoint entrenado ni métricas inventadas. Ejecutar `python3 ml/training/train_beto.py` con corpus y recursos autorizados; comparar con `train_baseline.py` y publicar accuracy, precision/recall/F1 por categoría, macro/micro, matriz, ROC cuando aplique e inferencia.
