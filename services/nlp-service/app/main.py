import json, os, re, time, unicodedata, secrets
from .preprocessing import normalize
from pathlib import Path
from typing import Any
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
INTENTS = ["CONSULTA_INFORMATIVA", "SOLICITUD_TRAMITE", "VERIFICACION_ESTADO", "REPORTE_PROBLEMA", "DERIVACION_ENTIDAD"]
BASE_DIR = Path(os.getenv("PROJECT_ROOT") or (str(Path(__file__).resolve().parents[3]) if len(Path(__file__).resolve().parents)>3 else "/workspace"))
BACKEND = os.getenv("NLP_BACKEND", "beto" if os.getenv("NODE_ENV") == "production" else "rules")
MODEL_PATH = Path(os.getenv("BETO_MODEL_PATH") or str(BASE_DIR / "ml/models/beto-intents-v1"))
BASELINE_PATH = Path(os.getenv("BASELINE_MODEL_PATH", str(BASE_DIR / "ml/models/baseline.joblib")))
trained_model = None
tokenizer = None
load_error = None
MODEL_MAX_LENGTH = 128
if BACKEND == "beto":
    try:
        if not (MODEL_PATH / "config.json").exists():
            raise ValueError("No existe un checkpoint BETO entrenado.")
        training_config = json.loads((MODEL_PATH / "training-config.json").read_text(encoding="utf-8"))
        if training_config.get("status") != "trained": raise ValueError("El checkpoint no tiene entrenamiento completado registrado.")
        RUNTIME = os.getenv("BETO_RUNTIME", "onnx" if (MODEL_PATH / "model.int8.onnx").exists() else "pytorch")
        if RUNTIME == "onnx":
            from .onnx_model import BetoOnnx
            trained_model = BetoOnnx(MODEL_PATH, int(os.getenv("NLP_CPU_THREADS", "2")))
            if set(trained_model.labels) != set(INTENTS): raise ValueError("Etiquetas ONNX incorrectas.")
            MODEL_MAX_LENGTH = trained_model.max_length
        elif RUNTIME == "pytorch":
            import torch
            torch.set_num_threads(int(os.getenv("NLP_CPU_THREADS", "2")))
            MODEL_MAX_LENGTH = int(training_config.get("maxLength", 128))
            if not 16 <= MODEL_MAX_LENGTH <= 512: raise ValueError("Longitud de tokenización inválida.")
            from transformers import AutoTokenizer, AutoModelForSequenceClassification
            tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, local_files_only=True)
            trained_model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH, local_files_only=True)
            if set(trained_model.config.id2label.values()) != set(INTENTS):
                raise ValueError("El checkpoint no tiene las cinco etiquetas esperadas.")
            DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
            trained_model.to(DEVICE).eval()
            # Readiness follows kernel/tokenizer warm-up so the first chat does not time out.
            warmup = tokenizer("Necesito información sobre el pasaporte", return_tensors="pt", truncation=True, max_length=MODEL_MAX_LENGTH).to(DEVICE)
            with torch.inference_mode(): trained_model(**warmup)
            if DEVICE == "cuda": torch.cuda.synchronize()
    
        else:
            raise ValueError("BETO_RUNTIME debe ser onnx o pytorch.")
    except Exception as error:
        trained_model = None
        load_error = str(error)
elif BACKEND == "baseline":
    try:
        import joblib
        trained_model = joblib.load(BASELINE_PATH)
    except Exception as error:
        load_error = str(error)
elif BACKEND != "rules":
    load_error = "NLP_BACKEND debe ser beto, baseline o rules."
MODEL_NAME = {"beto": "BETO fine-tuned", "baseline": "TF-IDF + Logistic Regression", "rules": "Reglas de demostración (sin entrenamiento)"} .get(BACKEND, "Unavailable")
MODEL_VERSION = os.getenv("MODEL_VERSION", "beto-intents-v1" if BACKEND == "beto" else BACKEND + "-v1")
class ClassifyRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1500)
class Classification(BaseModel):
    intent: str
    confidence: float
    entities: dict[str, Any]
    modelName: str = MODEL_NAME
    modelVersion: str = MODEL_VERSION
    backend: str = BACKEND
    processingTimeMs: float
app = FastAPI(title="Ciudadano AI - NLP", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=[os.getenv("PUBLIC_ORIGIN", "http://localhost:5173")], allow_methods=["GET","POST"], allow_headers=["authorization","content-type"])
def extract(text: str) -> dict[str, str]:
    normalized = normalize(text)
    bare = "".join(c for c in unicodedata.normalize("NFD",normalized) if unicodedata.category(c) != "Mn")
    entities = {}
    for name,terms in {"cedula":("cedula",), "pasaporte":("pasaporte",), "rut":("rut",), "libreta_militar":("libreta militar",), "licencia_conduccion":("licencia",)}.items():
        if any(term in bare for term in terms): entities["documentType"] = name; entities["procedureType"] = name; break
    for entity in ("registraduria","sisben","alcaldia","dian","colpensiones","cancilleria","policia","procuraduria","adres","sic"):
        if re.search(r"\b"+entity+r"\b",bare): entities["entity"] = entity
    for city in ("bogota","medellin","cali","barranquilla","cartagena","bucaramanga","pereira","manizales","cucuta","pasto","ibague","villavicencio"):
        if re.search(r"\b"+city+r"\b",bare): entities["city"] = city
    if any(term in bare for term in ("perdi","robo","hurto","extravi")): entities["reason"] = "pérdida o hurto"
    elif any(term in bare for term in ("renovar","renovacion","refrendar")): entities["reason"] = "renovación"
    return entities
def classify_text(text: str) -> tuple[str,float]:
    normalized = normalize(text)
    if load_error: raise RuntimeError(load_error)
    if BACKEND == "beto":
        if RUNTIME == "onnx": return trained_model.predict([normalized])[0]
        import torch
        inputs = tokenizer(normalized,return_tensors="pt",truncation=True,max_length=MODEL_MAX_LENGTH).to(DEVICE)
        with torch.inference_mode(): probabilities = torch.softmax(trained_model(**inputs).logits,dim=-1)[0]
        index = int(torch.argmax(probabilities))
        return trained_model.config.id2label[index],float(probabilities[index])
    if BACKEND == "baseline":
        prediction = trained_model.predict([normalized])[0]
        return str(prediction),float(max(trained_model.predict_proba([normalized])[0]))
    rules = [
        ("REPORTE_PROBLEMA", ("problema","error","fallo","falla","queja","no funciona","no carga")),
        ("VERIFICACION_ESTADO", ("estado","radicado","cómo va","como va","seguimiento")),
        ("SOLICITUD_TRAMITE", ("solicitar","sacar","duplicado","renovar","tramitar","necesito","expedir","inscribir")),
        ("DERIVACION_ENTIDAD", ("a quién","a quien","qué entidad","que entidad","oficina","sede")),
    ]
    for intent,terms in rules:
        matches=sum(term in normalized for term in terms)
        if matches: return intent,min(.96,.70+.06*matches)
    return "CONSULTA_INFORMATIVA", .76 if extract(normalized) else .45
@app.get("/health")
def health(): return {"status":"ok","service":"nlp-service","backend":BACKEND}
@app.get("/ready")
def ready():
    if load_error: raise HTTPException(503,detail=load_error)
    return {"status":"ready","backend":BACKEND,"modelLoaded":trained_model is not None,"modelName":MODEL_NAME}
def require_internal(x_internal_key: str | None = Header(default=None)):
    if os.getenv("NODE_ENV") == "production":
        expected = os.getenv("INTERNAL_API_KEY", "")
        if not expected: raise HTTPException(503, detail="Servicio interno sin configurar.")
        if not x_internal_key or not secrets.compare_digest(x_internal_key, expected):
            raise HTTPException(403, detail="Acceso interno requerido.")
@app.post("/api/v1/classify",response_model=Classification,dependencies=[Depends(require_internal)])
def classify(request: ClassifyRequest):
    started=time.perf_counter()
    try: intent,confidence=classify_text(request.text)
    except RuntimeError as error: raise HTTPException(503,detail=str(error)) from error
    return Classification(intent=intent,confidence=confidence,entities=extract(request.text),processingTimeMs=round((time.perf_counter()-started)*1000,3))
@app.post("/api/v1/extract-entities",dependencies=[Depends(require_internal)])
def extract_entities(request: ClassifyRequest): return {"entities":extract(request.text),"modelVersion":MODEL_VERSION}
@app.get("/api/v1/models/current")
def current_model(): return {"runtime":globals().get("RUNTIME", BACKEND),"modelName":MODEL_NAME,"modelVersion":MODEL_VERSION,"loaded":trained_model is not None,"backend":BACKEND,"classes":INTENTS,"error":load_error,"academicResultsAvailable":bool(json.loads((MODEL_PATH/"test-metrics.json").read_text(encoding="utf-8")).get("academic")) if (MODEL_PATH/"test-metrics.json").exists() else False}
@app.get("/api/v1/models/metrics")
def model_metrics():
    result={"available":False}
    for key,path in {"baseline":BASE_DIR/"research/evidence/baseline-metrics.json","evaluation":MODEL_PATH/"test-metrics.json"}.items():
        if path.exists(): result[key]=json.loads(path.read_text(encoding="utf-8")); result["available"]=True
    return result
