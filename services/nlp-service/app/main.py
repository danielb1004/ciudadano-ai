import json
import os
import re
import time
import unicodedata
from pathlib import Path
from typing import Any, Optional
from fastapi import FastAPI
from pydantic import BaseModel, Field

INTENTS = [
    "CONSULTA_INFORMATIVA",
    "SOLICITUD_TRAMITE",
    "VERIFICACION_ESTADO",
    "REPORTE_PROBLEMA",
    "DERIVACION_ENTIDAD"
]

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
MODEL_NAME = "TF-IDF + Logistic Regression (Baseline)"
MODEL_VERSION = "baseline-v1.0"
MODEL_PATH = BASE_DIR / "ml/models/baseline.joblib"
BASELINE_METRICS_PATH = BASE_DIR / "research/evidence/baseline-metrics.json"
NLP_METRICS_PATH = BASE_DIR / "research/evidence/nlp-metrics.json"

trained_model = None

def load_ml_model():
    global trained_model, MODEL_NAME, MODEL_VERSION
    if MODEL_PATH.exists():
        try:
            import joblib
            trained_model = joblib.load(MODEL_PATH)
            MODEL_NAME = "TFIDF-LogisticRegression-Trained"
            MODEL_VERSION = "model-joblib-v1"
            print(f"ML Model successfully loaded from {MODEL_PATH}")
        except Exception as e:
            print(f"Notice: Falling back to rules. Reason: {e}")

load_ml_model()

class ClassifyRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)

class Classification(BaseModel):
    intent: str
    confidence: float
    entities: dict[str, Any]
    modelName: str = MODEL_NAME
    modelVersion: str = MODEL_VERSION
    processingTimeMs: float

class EntityRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)

app = FastAPI(title="Ciudadano AI - NLP", version="1.0.0")

def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).lower().strip()
    text = re.sub(r"\b\d{6,12}\b", " [id_redacted] ", text)
    text = re.sub(r"\s+", " ", text)
    for source, target in {
        "pqrs": "peticiones quejas reclamos sugerencias",
        "ced": "cedula",
        "sisbén": "sisben",
        "cancilleria": "cancillería",
        "dian": "dian",
        "adres": "adres"
    }.items():
        text = text.replace(source, target)
    return text

def extract(text: str) -> dict[str, str]:
    normalized = normalize(text)
    entities: dict[str, str] = {}

    if "cedul" in normalized or "cédul" in normalized or "documento" in normalized:
        entities["documentType"] = "cedula"
    elif "pasaporte" in normalized:
        entities["documentType"] = "pasaporte"
    elif "rut" in normalized:
        entities["documentType"] = "rut"
    elif "libreta" in normalized or "militar" in normalized:
        entities["documentType"] = "libreta_militar"
    elif "licencia" in normalized:
        entities["documentType"] = "licencia_conduccion"

    if any(word in normalized for word in ("perdí", "perdi", "robo", "hurt", "extravi")):
        entities["reason"] = "pérdida o hurto"
    elif any(word in normalized for word in ("renovar", "renovac", "refrendar")):
        entities["reason"] = "renovación"
    elif any(word in normalized for word in ("primera vez", "expedir")):
        entities["reason"] = "primera vez"

    for entity in ("registraduria", "sisben", "alcaldia", "dian", "colpensiones", "cancilleria", "policia", "procuraduria", "adres", "sic"):
        if entity in normalized:
            entities["entity"] = entity

    return entities

def classify_text(text: str) -> tuple[str, float]:
    global trained_model
    normalized = normalize(text)

    # 1. Inferencia mediante modelo entrenado si está disponible
    if trained_model is not None:
        try:
            pred = trained_model.predict([normalized])[0]
            proba = max(trained_model.predict_proba([normalized])[0])
            return str(pred), round(float(proba), 4)
        except Exception:
            pass

    # 2. Reglas semánticas de respaldo de alta fidelidad
    rules = [
        ("REPORTE_PROBLEMA", ("problema", "error", "falló", "falla", "queja", "no funciona", "se cayó", "no carga", "bloquead")),
        ("VERIFICACION_ESTADO", ("estado", "radicado", "respuesta", "cómo va", "como va", "verificar si", "consultar si", "revisar el estado")),
        ("SOLICITUD_TRAMITE", ("solicitar", "sacar", "duplicado", "renovar", "tramitar", "necesito", "postularme", "expedir", "inscribir")),
        ("DERIVACION_ENTIDAD", ("entidad", "oficina", "a quién", "a quien", "dónde", "donde", "a qué entidad", "organismo", "sede"))
    ]

    for intent, keywords in rules:
        if any(keyword in normalized for keyword in keywords):
            confidence = min(0.96, 0.70 + 0.06 * sum(keyword in normalized for keyword in keywords))
            return intent, round(confidence, 4)

    return "CONSULTA_INFORMATIVA", 0.65 if len(normalized.split()) > 2 else 0.45

@app.get("/health")
def health():
    return {"status": "ok", "service": "nlp-service", "model": MODEL_NAME}

@app.get("/ready")
def ready():
    return {
        "status": "ready",
        "modelLoaded": trained_model is not None,
        "modelName": MODEL_NAME,
        "modelVersion": MODEL_VERSION
    }

@app.get("/metrics")
def metrics():
    return f'# HELP nlp_inference_info NLP inference availability\n# TYPE nlp_inference_info gauge\nnlp_inference_info{{model="{MODEL_NAME}",version="{MODEL_VERSION}"}} 1\n'

@app.post("/api/v1/classify", response_model=Classification)
def classify(request: ClassifyRequest):
    started = time.perf_counter()
    intent, confidence = classify_text(request.text)
    entities = extract(request.text)
    processing_time = round((time.perf_counter() - started) * 1000, 3)
    return Classification(
        intent=intent,
        confidence=confidence,
        entities=entities,
        modelName=MODEL_NAME,
        modelVersion=MODEL_VERSION,
        processingTimeMs=processing_time
    )

@app.post("/api/v1/extract-entities")
def extract_entities(request: EntityRequest):
    return {"entities": extract(request.text), "modelVersion": MODEL_VERSION}

@app.get("/api/v1/models/current")
def current_model():
    return {
        "modelName": MODEL_NAME,
        "modelVersion": MODEL_VERSION,
        "loaded": trained_model is not None,
        "classes": INTENTS,
        "framework": "scikit-learn Pipeline (TfidfVectorizer + LogisticRegression)",
        "features": "Word + Bigrams n-grams, unicode accent stripping",
        "dataset": "ml/datasets/corpus-v1.csv"
    }

@app.get("/api/v1/models/metrics")
def model_metrics():
    data: dict[str, Any] = {"available": False}
    if BASELINE_METRICS_PATH.exists():
        data["baseline"] = json.loads(BASELINE_METRICS_PATH.read_text(encoding="utf-8"))
        data["available"] = True
    if NLP_METRICS_PATH.exists():
        data["evaluation"] = json.loads(NLP_METRICS_PATH.read_text(encoding="utf-8"))
        data["available"] = True

    return data
