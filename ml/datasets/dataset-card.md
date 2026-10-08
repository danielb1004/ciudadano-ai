# Dataset card

## synthetic-v1.csv

- Origen: generación local determinista mediante 100 plantillas escritas para este proyecto.
- Tamaño: 2.340 textos únicos tras normalización; 468 por cada una de las cinco intenciones.
- Cobertura temática: 15 tipos de trámite; referencias a 12 ciudades colombianas.
- Variación: preguntas, solicitudes, seguimiento, errores de portal, derivación y saludos informales.
- Etiquetado: intención determinada por la plantilla; sin revisión humana independiente.
- Datos de personas reales: ninguno. Consentimiento: no aplicable a estos ejemplos generados.
- Semilla: 42. Procedencia, hash y límites se registran en synthetic-v1.manifest.json.
- Particiones: por familia de plantilla, aproximadamente 70/15/15; tamaños efectivos en el manifiesto.
- Uso: desarrollo, entrenamiento experimental y diagnóstico del prototipo.
- Restricción de interpretación: academic=false. No reproduce el estudio con ciudadanos del Word.

Las plantillas son limitadas, las clases están balanceadas artificialmente y las ciudades
son referencias textuales. No existe evidencia de representatividad por edad, región o
experiencia digital. Tampoco se generan trámites reales, tarifas, radicados ni respuestas SUS.

## Material anterior y objetivo académico

demo.csv tiene 10 ejemplos; corpus-v1.csv tiene 100 filas demostrativas.
El corpus real, autorizado y revisado que menciona el Word continúa pendiente.
Para ese corpus se deben documentar fuentes, licencias, consentimiento, revisores y muestreo.
