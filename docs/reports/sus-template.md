# Informe SUS (plantilla)

Incluir muestra, ronda, diez respuestas 1–5, puntuación individual, media, mediana, desviación estándar, percentiles y comparación por edad. La fórmula está implementada en `research/sus/analyze_sus.py`: ítems impares restan 1, pares se transforman como `5 - respuesta`, y la suma se multiplica por 2,5. No cargar cifras de referencia como resultados.
