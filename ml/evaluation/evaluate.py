"""Evaluate the running model on the fixed held-out split; never resplit."""
import argparse, csv, hashlib, json, statistics, time, os
from datetime import datetime, timezone
from pathlib import Path
import httpx
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score

def evaluate(splits, endpoint, allow_demo=False):
    splits = Path(splits)
    manifest = json.loads((splits / "manifest.json").read_text(encoding="utf-8"))
    sets = {}
    for name in ("train", "validation", "test"):
        with (splits / (name + ".csv")).open(encoding="utf-8-sig", newline="") as source:
            sets[name] = list(csv.DictReader(source))
    normalize = lambda text: " ".join(text.casefold().split())
    keys = {name: {normalize(row["text"]) for row in rows} for name, rows in sets.items()}
    if any(keys[a] & keys[b] for a,b in (("train","validation"),("train","test"),("validation","test"))):
        raise ValueError("Las particiones contienen textos compartidos.")
    if manifest.get("splitStrategy") == "template_family":
        if any(not row.get("template_family") for rows in sets.values() for row in rows):
            raise ValueError("Falta la familia de plantilla en una partición sintética.")
        families = {name: {row["template_family"] for row in rows} for name, rows in sets.items()}
        if any(families[a] & families[b] for a,b in (("train","validation"),("train","test"),("validation","test"))):
            raise ValueError("Las particiones contienen familias de plantillas compartidas.")
    test = sets["test"]
    if not test: raise ValueError("No hay muestras de prueba.")
    with httpx.Client(base_url=endpoint.rstrip("/"), timeout=10, headers={"x-internal-key":os.getenv("NLP_INTERNAL_API_KEY",os.getenv("INTERNAL_API_KEY",""))}) as client:
        response = client.get("/api/v1/models/current"); response.raise_for_status(); model = response.json()
        if model.get("backend") == "rules" and not allow_demo:
            raise ValueError("El backend usa reglas de demostración; no es una evaluación BETO. Usa --allow-demo solo para diagnóstico.")
        if not manifest.get("academic") and not allow_demo:
            raise ValueError("El corpus no tiene validación académica. Usa --allow-demo solo para diagnóstico.")
        actual, predicted, latencies, processing = [], [], [], []
        for row in test:
            started = time.perf_counter()
            response = client.post("/api/v1/classify", json={"text":row["text"]})
            response.raise_for_status(); result = response.json()
            if result.get("backend") != model.get("backend") or result.get("modelVersion") != model.get("modelVersion"):
                raise ValueError("El modelo cambió durante la evaluación.")
            actual.append(row["intent"]); predicted.append(result["intent"])
            latencies.append((time.perf_counter()-started)*1000); processing.append(result["processingTimeMs"])
    labels = manifest["classes"]
    percentile = lambda values, q: sorted(values)[min(len(values)-1, int((len(values)-1)*q))]
    return {"recordedAt":datetime.now(timezone.utc).isoformat(), "model":model,
            "academic":bool(manifest.get("academic")) and model.get("backend") == "beto",
            "dataset":manifest, "testSha256":hashlib.sha256((splits/"test.csv").read_bytes()).hexdigest(),
            "sampleCount":len(test), "accuracy":accuracy_score(actual,predicted),
            "f1Macro":f1_score(actual,predicted,labels=labels,average="macro",zero_division=0),
            "f1Micro":f1_score(actual,predicted,average="micro",zero_division=0),
            "labels":labels, "confusionMatrix":confusion_matrix(actual,predicted,labels=labels).tolist(),
            "perCategory":classification_report(actual,predicted,labels=labels,output_dict=True,zero_division=0),
            "inferenceTimeMs":{"mean":statistics.mean(processing),"p95":percentile(processing,.95)},
            "httpLatencyMs":{"mean":statistics.mean(latencies),"p50":percentile(latencies,.5),"p95":percentile(latencies,.95),"p99":percentile(latencies,.99)}}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--splits",default="ml/datasets/splits")
    parser.add_argument("--endpoint",default="http://localhost:8001")
    parser.add_argument("--output",default="research/evidence/nlp-evaluation.json")
    parser.add_argument("--allow-demo",action="store_true")
    args=parser.parse_args()
    try: result=evaluate(args.splits,args.endpoint,args.allow_demo)
    except (ValueError,httpx.HTTPError) as error: raise SystemExit(str(error)) from error
    output=Path(args.output); output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding="utf-8")
    print(json.dumps({"sampleCount":result["sampleCount"],"academic":result["academic"],"f1Macro":result["f1Macro"]}))
if __name__ == "__main__": main()
