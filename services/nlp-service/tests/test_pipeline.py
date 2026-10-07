from app.main import classify_text, extract, normalize
def test_normalization_and_anonymization():
    value = normalize("Mi CÉDULA 1234567890, ¿cómo va el trámite?"); assert "1234567890" not in value and "trámite" in value
def test_five_intents_are_reachable():
    examples = ["qué requisitos existen", "necesito sacar duplicado", "cómo va mi radicado", "tengo un problema", "a qué entidad voy"]
    assert {classify_text(example)[0] for example in examples} == {"CONSULTA_INFORMATIVA", "SOLICITUD_TRAMITE", "VERIFICACION_ESTADO", "REPORTE_PROBLEMA", "DERIVACION_ENTIDAD"}
def test_entities(): assert extract("Perdí mi cédula en Bogotá") == {"documentType": "cedula", "reason": "pérdida o hurto"}
