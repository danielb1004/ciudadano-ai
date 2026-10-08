"""Prepare disjoint sets, keeping synthetic template families together."""
import argparse
import csv
import hashlib
import json
import random
from collections import defaultdict
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services/nlp-service/app"))
from preprocessing import normalize

INTENTS = ["CONSULTA_INFORMATIVA", "SOLICITUD_TRAMITE", "VERIFICACION_ESTADO", "REPORTE_PROBLEMA", "DERIVACION_ENTIDAD"]

def prepare(data, output, academic=False, seed=42):
    data, output = Path(data), Path(output)
    with data.open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    if not rows:
        raise ValueError("El corpus está vacío.")
    synthetic = [str(row.get("is_synthetic", "")).lower() in ("true", "1", "yes")
                 or str(row.get("source", "")).lower().startswith("synthetic:") for row in rows]
    if academic and any(synthetic):
        raise ValueError("Los datos sintéticos no pueden presentarse como consultas reales mediante --academic.")
    grouped = any(row.get("template_family") for row in rows)
    if grouped and any(not row.get("template_family") for row in rows):
        raise ValueError("Cada muestra necesita template_family cuando se separa por familias.")
    if any(synthetic) and not grouped:
        raise ValueError("El corpus sintético requiere template_family para evitar fuga entre particiones.")
    groups, seen, owners = defaultdict(list), {}, {}
    for row in rows:
        text, intent = normalize(row.get("text", "")), row.get("intent", "")
        if not text or intent not in INTENTS:
            raise ValueError("Cada muestra necesita text e intent válido.")
        key = " ".join(text.casefold().split())
        if key in seen:
            if seen[key] != intent:
                raise ValueError("Hay textos duplicados con etiquetas contradictorias.")
            continue
        seen[key] = intent
        if academic and (not row.get("source") or row.get("consent", "").lower() not in ("true", "yes", "1") or not row.get("reviewer")):
            raise ValueError("Para evaluación académica se exige source, consent y reviewer en cada muestra.")
        sample = {"text": text, "intent": intent}
        if grouped:
            family = row["template_family"]
            if family in owners and owners[family] != intent:
                raise ValueError("Una familia de plantillas no puede mezclar intenciones.")
            owners[family] = intent
            sample["template_family"] = family
        groups[intent].append(sample)
    count = sum(map(len, groups.values()))
    if academic and count < 2340:
        raise ValueError(f"El Word requiere 2.340 muestras válidas; hay {count}.")
    if any(len(groups[intent]) < 6 for intent in INTENTS):
        raise ValueError("Se requieren al menos seis textos únicos por cada una de las cinco clases.")
    rng = random.Random(seed)
    splits = {name: [] for name in ("train", "validation", "test")}
    for intent in INTENTS:
        if grouped:
            families = defaultdict(list)
            for sample in groups[intent]:
                families[sample["template_family"]].append(sample)
            units = [families[name] for name in sorted(families)]
            if len(units) < 6:
                raise ValueError("Se requieren al menos seis familias por clase.")
        else:
            units = [[sample] for sample in groups[intent]]
        rng.shuffle(units)
        n_test, n_val = max(1, round(len(units) * .15)), max(1, round(len(units) * .15))
        allocations = {"test": units[:n_test], "validation": units[n_test:n_test+n_val],
                       "train": units[n_test+n_val:]}
        for name, selected in allocations.items():
            splits[name].extend(sample for unit in selected for sample in unit)
    output.mkdir(parents=True, exist_ok=True)
    fields = ["text", "intent"] + (["template_family"] if grouped else [])
    for name, samples in splits.items():
        rng.shuffle(samples)
        with (output / f"{name}.csv").open("w", encoding="utf-8", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=fields)
            writer.writeheader()
            writer.writerows(samples)
    dataset_type = "synthetic" if all(synthetic) else "mixed" if any(synthetic) else "unverified"
    manifest = {"dataset": str(data.resolve()), "sha256": hashlib.sha256(data.read_bytes()).hexdigest(),
                "seed": seed, "uniqueSamples": count, "academic": academic, "datasetType": dataset_type,
                "duplicatesRemoved": len(rows)-count, "classes": INTENTS,
                "splitStrategy": "template_family" if grouped else "stratified_text",
                "splitCounts": {k: len(v) for k, v in splits.items()},
                "classCounts": {k: len(v) for k, v in groups.items()}}
    if grouped:
        manifest["familyCounts"] = {name: len({row["template_family"] for row in samples})
                                    for name, samples in splits.items()}
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    return manifest

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True)
    parser.add_argument("--output-dir", default="ml/datasets/splits")
    parser.add_argument("--academic", action="store_true")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    try:
        print(json.dumps(prepare(args.data, args.output_dir, args.academic, args.seed), indent=2))
    except ValueError as error:
        raise SystemExit(str(error)) from error

if __name__ == "__main__":
    main()
