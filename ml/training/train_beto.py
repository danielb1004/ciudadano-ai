"""Prepara el fine-tuning de BETO. El corpus real y los recursos deben existir antes de entrenar."""
import argparse, json
from pathlib import Path
def main():
    p=argparse.ArgumentParser(); p.add_argument("--data",default="ml/datasets/corpus-v1.csv"); p.add_argument("--output-dir",default="ml/models/beto-intents-v1"); a=p.parse_args()
    if not Path(a.data).exists(): raise SystemExit(f"No existe {a.data}. Carga el corpus consentido antes de entrenar BETO.")
    Path(a.output_dir).mkdir(parents=True,exist_ok=True); Path(a.output_dir,"training-config.json").write_text(json.dumps({"baseModel":"dccuchile/bert-base-spanish-wwm-cased","earlyStopping":True,"seed":42,"status":"prepared"},indent=2),encoding="utf-8")
if __name__=="__main__": main()
