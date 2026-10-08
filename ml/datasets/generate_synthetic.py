"""Generate reproducible synthetic queries, never records of real participants."""
import argparse
import csv
import hashlib
import json
import random
from collections import Counter
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services/nlp-service/app"))
from preprocessing import normalize

TEMPLATES = {
    "CONSULTA_INFORMATIVA": [
        "¿Qué documentos piden para {procedure} en {city}?",
        "¿Cuánto cuesta {procedure} en {city}?",
        "¿Cuál es el plazo habitual de {procedure} en {city}?",
        "Explícame los requisitos de {procedure} en {city}.",
        "¿Se puede hacer {procedure} por internet desde {city}?",
        "¿Hace falta una cita para {procedure} en {city}?",
        "¿Qué diferencia hay entre la atención presencial y virtual para {procedure} en {city}?",
        "Antes de empezar, quiero conocer los pasos de {procedure} en {city}.",
        "¿Qué edad mínima se exige para {procedure} en {city}?",
        "¿Qué comprobantes debo llevar para {procedure} en {city}?",
        "Busco información general sobre {procedure} en {city}.",
        "¿Hay algún pago relacionado con {procedure} en {city}?",
        "Me explicas en palabras sencillas en qué consiste {procedure} en {city}.",
        "¿Las condiciones de {procedure} son las mismas para todos en {city}?",
        "¿Qué datos pide el formulario de {procedure} en {city}?",
        "Vivo en {city}, ¿dónde leo los requisitos oficiales de {procedure}?",
        "¿Cuáles son las etapas de {procedure} para alguien de {city}?",
        "¿Hay una guía para entender {procedure} en {city}?",
        "¿Debo presentar originales o copias para {procedure} en {city}?",
        "Estoy averiguando cómo es {procedure} en {city}, todavía no voy a iniciarlo.",
    ],
    "SOLICITUD_TRAMITE": [
        "Quiero iniciar {procedure} en {city}.",
        "Ayúdame a tramitar {procedure} desde {city}.",
        "Necesito hacer {procedure} en {city}, ¿cómo empiezo?",
        "Voy a gestionar {procedure} en {city} y busco el primer paso.",
        "Quisiera presentar una solicitud de {procedure} en {city}.",
        "Deseo comenzar el proceso de {procedure} en {city}.",
        "Me interesa realizar {procedure} en {city} ahora.",
        "Indícame cómo radicar una nueva solicitud de {procedure} en {city}.",
        "Quiero agendar el inicio de {procedure} en {city}.",
        "¿Me ayudas a arrancar con {procedure} en {city}?",
        "Es mi primera vez haciendo {procedure} en {city}; quiero empezarlo.",
        "Voy a diligenciar la solicitud de {procedure} en {city}.",
        "Necesito el enlace para iniciar {procedure} desde {city}.",
        "Quiero pasar de la información a la solicitud de {procedure} en {city}.",
        "Tengo los documentos listos y voy a empezar {procedure} en {city}.",
        "Quiero abrir una gestión nueva de {procedure} en {city}.",
        "Busco comenzar {procedure} por el canal oficial de {city}.",
        "Ya decidí hacer {procedure} en {city}; orienta mi solicitud.",
        "Por favor, guíame para solicitar {procedure} en {city}.",
        "Estoy listo para tramitar {procedure} en {city}, ¿cuál es el paso inicial?",
    ],
    "VERIFICACION_ESTADO": [
        "¿En qué estado está mi solicitud de {procedure} presentada en {city}?",
        "Ya hice {procedure} en {city}, ¿cómo va la gestión?",
        "Quiero consultar el avance de {procedure} que radiqué en {city}.",
        "¿Cómo hago seguimiento a mi solicitud existente de {procedure} en {city}?",
        "Tengo un radicado de {procedure} en {city} y busco su estado.",
        "¿Ya respondieron mi petición de {procedure} en {city}?",
        "Presenté {procedure} en {city}, ¿sigue en revisión?",
        "Busco saber si aprobaron mi solicitud de {procedure} en {city}.",
        "¿Puedo revisar el progreso de {procedure} que entregué en {city}?",
        "Quiero saber si ya está listo el resultado de {procedure} en {city}.",
        "Hace unos días presenté {procedure} en {city}; ¿en qué etapa va?",
        "¿Dónde miro la respuesta a mi radicación de {procedure} en {city}?",
        "Me dieron un comprobante de {procedure} en {city}; quiero revisar la gestión.",
        "¿Han actualizado el estado de mi petición de {procedure} en {city}?",
        "¿Mi solicitud anterior de {procedure} en {city} continúa pendiente?",
        "Ya envié los documentos de {procedure} en {city}; busco la respuesta.",
        "Necesito consultar si finalizaron {procedure} que inicié en {city}.",
        "¿Cómo veo el resultado de mi solicitud registrada de {procedure} en {city}?",
        "Tengo una gestión abierta de {procedure} en {city} y quiero ver su avance.",
        "¿Hay novedades de mi trámite de {procedure} radicado en {city}?",
    ],
    "REPORTE_PROBLEMA": [
        "La página de {procedure} no carga cuando entro desde {city}.",
        "Me sale un error al llenar el formulario de {procedure} en {city}.",
        "El sistema de {procedure} en {city} se queda bloqueado.",
        "Intenté pagar {procedure} en {city} y el portal rechazó la operación.",
        "El botón para continuar con {procedure} en {city} no funciona.",
        "No puedo adjuntar los documentos de {procedure} en {city}; aparece un fallo.",
        "Se borró la información mientras hacía {procedure} en {city}.",
        "El enlace de {procedure} para {city} está roto.",
        "El portal de {procedure} en {city} se cierra sin guardar.",
        "La plataforma muestra un error de conexión al hacer {procedure} en {city}.",
        "El formulario de {procedure} en {city} rechaza datos que son correctos.",
        "Quiero reportar una falla en el servicio de {procedure} en {city}.",
        "El código de verificación de {procedure} en {city} no llega.",
        "La pantalla de {procedure} en {city} queda en blanco.",
        "Se cayó el portal cuando estaba con {procedure} en {city}.",
        "El comprobante de {procedure} en {city} no se puede descargar.",
        "Aparece un cobro repetido durante {procedure} en {city}.",
        "No me deja ingresar a la plataforma de {procedure} en {city}.",
        "La cita de {procedure} en {city} desapareció del sistema.",
        "Hay un problema: el portal de {procedure} en {city} no termina de procesar.",
    ],
    "DERIVACION_ENTIDAD": [
        "¿Qué entidad atiende {procedure} en {city}?",
        "¿A cuál oficina debo dirigirme por {procedure} en {city}?",
        "¿Quién es el responsable institucional de {procedure} en {city}?",
        "Quiero contactar a la entidad encargada de {procedure} en {city}.",
        "¿Con qué institución hablo sobre {procedure} en {city}?",
        "Oriéntame hacia el canal oficial de atención de {procedure} en {city}.",
        "¿Hay una sede que atienda consultas sobre {procedure} en {city}?",
        "Busco el contacto de la autoridad competente para {procedure} en {city}.",
        "¿A qué dependencia le corresponde {procedure} en {city}?",
        "Quiero hablar con un funcionario responsable de {procedure} en {city}.",
        "¿Dónde me atiende una persona por {procedure} en {city}?",
        "¿Cuál es el canal institucional para pedir orientación sobre {procedure} en {city}?",
        "Necesito comunicarme con la oficina encargada de {procedure} en {city}.",
        "¿Me remites a la entidad que maneja {procedure} en {city}?",
        "¿Qué organismo puede atender mi consulta de {procedure} en {city}?",
        "Quiero la dirección de la sede competente para {procedure} en {city}.",
        "¿Cómo contacto al área de atención ciudadana de {procedure} en {city}?",
        "¿Existe una línea de atención oficial para {procedure} en {city}?",
        "Busco atención presencial de la institución que lleva {procedure} en {city}.",
        "¿A quién le corresponde orientarme sobre {procedure} en {city}?",
    ],
}
PROCEDURES = [
    "el duplicado de la cédula", "la cédula digital", "el pasaporte ordinario",
    "la inscripción del RUT", "la actualización del RUT", "la encuesta del Sisbén",
    "la consulta de historia laboral", "la renovación de la licencia de conducción",
    "el certificado de antecedentes judiciales", "el certificado de antecedentes disciplinarios",
    "el certificado de antecedentes fiscales", "el certificado de afiliación a salud",
    "el registro civil de nacimiento", "la corrección del registro civil", "la presentación de PQRS",
]
CITIES = ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena", "Bucaramanga",
          "Pereira", "Manizales", "Cúcuta", "Pasto", "Ibagué", "Villavicencio"]
PREFIXES = ["", "Hola, ", "Buenas, ", "Por favor, ", "Buenos días, ", "Buenas tardes, ",
            "Disculpa, ", "Me haces el favor: ", "Una preguntica: ", "Buenas, ¿me colaboras? "]

def generate(output, seed=42):
    output = Path(output)
    rng = random.Random(seed)
    contexts = [{"procedure": PROCEDURES[i % len(PROCEDURES)],
                 "city": CITIES[i % len(CITIES)]} for i in range(24)]
    rows, seen = [], set()
    for intent, templates in TEMPLATES.items():
        extra = set(rng.sample(range(20), 8))
        for index, template in enumerate(templates):
            # 8 * 24 + 12 * 23 = 468 queries per intent.
            choices = rng.sample(contexts, 24 if index in extra else 23)
            for variant, context in enumerate(choices):
                prefix = PREFIXES[(index + variant) % len(PREFIXES)]
                text = (prefix + template.format(**context)).replace("de el ", "del ").replace("a el ", "al ")
                key = normalize(text)
                if key in seen:
                    raise ValueError("Duplicate normalized synthetic query.")
                if len(text) > 500:
                    raise ValueError("Query exceeds the frontend/API limit.")
                seen.add(key)
                rows.append({
                    "sample_id": f"syn-{len(rows) + 1:04d}",
                    "text": text, "intent": intent,
                    "source": "synthetic:handwritten-templates-v1",
                    "is_synthetic": "true", "consent": "not_applicable",
                    "reviewer": "", "reviewStatus": "not_human_reviewed",
                    "template_family": f"{intent}:{index + 1:02d}",
                    "procedure": context["procedure"], "city": context["city"],
                })
    rng.shuffle(rows)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    manifest = {
        "datasetType": "synthetic", "academic": False, "generatorVersion": "templates-v1",
        "seed": seed, "sampleCount": len(rows), "uniqueNormalizedSamples": len(seen),
        "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        "classCounts": dict(Counter(row["intent"] for row in rows)),
        "templateFamilies": len(TEMPLATES) * 20, "cities": CITIES,
        "procedureCount": len(PROCEDURES), "humanParticipants": 0,
        "humanLabelReview": False, "maxCharacters": max(len(row["text"]) for row in rows),
        "limitations": [
            "Queries were generated, not collected from citizens.",
            "Labels follow templates and have not received independent human review.",
            "Geographic names and informal phrases do not establish population representativeness.",
            "Synthetic evaluation cannot substantiate the empirical results in the Word document.",
            "Context vocabulary is shared across split sets; template families must remain disjoint.",
        ],
    }
    output.with_suffix(".manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="ml/datasets/synthetic-v1.csv")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    print(json.dumps(generate(args.output, args.seed), indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
