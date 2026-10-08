# Model card

BETO: dccuchile/bert-base-spanish-wwm-cased, cinco intenciones. Revisión base c4d86612f51b4f46759c8390d1798c2febe71b93.

## Corpus y entrenamiento

Corpus synthetic-v1: 2.340 consultas creadas con plantillas; academic=false y sin revisión humana. Las familias completas se separan: 1.640 entrenamiento, 354 validación y 346 prueba. No hay familias ni textos compartidos.

Se entrenaron las dos últimas capas del encoder, el pooler y el clasificador. Batch 8, longitud máxima 96, hasta cinco épocas, parada temprana tras tres y selección por validación. GPU GTX 860M. El entrenamiento se realizó con PyTorch 2.7.1+cu118 y Transformers 4.57.6; esas versiones históricas no son las dependencias del servidor.

| Variante | F1 macro en prueba sintética |
|---|---:|
| TF-IDF + regresión logística | 0,7406 |
| BETO con encoder congelado | 0,6724 |
| BETO con ajuste de dos capas | 0,8836 |

Exactitud del modelo seleccionado: 0,8931. Comparación experimental entre variantes sobre la misma partición; no equivale a validación con consultas reales.

## Runtime desplegado

AWS ejecuta ONNX FP32, con el checkpoint verificado por SHA-256, sin PyTorch ni Transformers en el contenedor. La exportación FP32 tuvo un error máximo de logits de 0,00000167 en el control numérico y conservó las predicciones de la prueba reservada.

La versión INT8 no fue aprobada: su F1 macro medido fue 0,0665. El manifiesto runtime-config.json selecciona model.onnx y conserva int8Approved=false. No activar INT8 basándose únicamente en que el archivo exista.

En AWS, evaluación secuencial de 346 consultas: F1 macro 0,8836, exactitud 0,8931, inferencia media 68,00 ms y p95 89,14 ms. Son datos sintéticos; no acreditan rendimiento con 500 usuarios.

Pendientes: corpus real consentido, revisión humana, calibración, sesgos y evaluación con usuarios. Las cifras originales del Word no se atribuyen a este experimento.
