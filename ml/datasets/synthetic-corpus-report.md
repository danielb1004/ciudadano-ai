# Corpus sintético y entrenamiento inicial

## Datos creados

Se generaron 2.340 consultas mediante 100 familias de redacción y contextos de trámites
colombianos. Cada intención tiene 468 ejemplos. Los textos incluyen preguntas,
solicitudes nuevas, seguimiento de solicitudes existentes, problemas de plataforma
y petición de contacto institucional.

- Generador: generate_synthetic.py; semilla 42.
- Corpus: synthetic-v1.csv y synthetic-v1.manifest.json.
- Sin conversaciones de personas reales ni revisión humana de etiquetas.
- Cada fila conserva procedencia sintética; academic=false.

## Particiones

Las familias completas se separan; ninguna plantilla se distribuye entre conjuntos.
La proporción se aplica a familias, por lo que el número de textos varía ligeramente:

| Conjunto | Consultas | Familias |
|---|---:|---:|
| Entrenamiento | 1.640 | 70 |
| Validación | 354 | 15 |
| Prueba | 346 | 15 |

Se mantiene vocabulario común de trámites y ciudades. La evaluación mide generalización
entre familias sintéticas del generador; no es una evaluación poblacional.

## Entrenamiento efectuado

Se entrenó **TF-IDF + regresión logística**. Se seleccionó C=2 mediante validación
y se evaluó el modelo seleccionado sobre las 346 consultas reservadas.

| Métrica | Resultado medido |
|---|---:|
| Exactitud | 0,7399 |
| F1 macro | 0,7406 |

Métricas completas: ../evaluation/synthetic-baseline-metrics.json.
Modelo local: ../models/baseline-synthetic-v1.joblib.

Estos valores corresponden a la baseline y a datos sintéticos. No son los resultados
BETO del Word. Las confusiones entre información y solicitud indican que debe mejorarse
la generalización semántica; no se modifica la partición de prueba para subir el resultado.

## BETO

Se entrenó BETO con estas particiones y cinco etiquetas en ml/models/beto-synthetic-v1. F1 macro 0,8836 y exactitud 0,8931 en 346 consultas reservadas. La versión ONNX FP32 conserva esos resultados; INT8 no fue aprobada. AWS registró inferencia media 68 ms y p95 89 ms.

El servidor actual conserva su backend configurado; generar el corpus no cambia
automáticamente el modelo del chat.

## Alcance del avance

El corpus permite continuar el entrenamiento experimental del prototipo.
Las pruebas de carga pueden ejecutarse con usuarios virtuales y registrar el rendimiento
real del sistema. Una evaluación SUS con participantes requiere respuestas reales:
este generador no crea participantes ni respuestas de encuestas.
