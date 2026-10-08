"""Validate actual consented SUS responses and calculate scores, by round."""
import argparse, csv, json, math, statistics
from pathlib import Path

def score(row):
    values=[]
    for i in range(1,11):
        value=float(row[f"q{i}"])
        if not math.isfinite(value) or not value.is_integer() or not 1<=value<=5:
            raise ValueError("Cada respuesta q1..q10 debe ser un entero entre 1 y 5.")
        values.append(value)
    return sum(v-1 if i%2 else 5-v for i,v in enumerate(values,1))*2.5

def analyze(path):
    with Path(path).open(encoding="utf-8-sig",newline="") as stream: rows=list(csv.DictReader(stream))
    if not rows: raise ValueError("No hay respuestas SUS reales; el formulario está vacío.")
    seen=set(); rounds={}
    for row in rows:
        participant=row.get("participant","").strip(); round_id=row.get("round","").strip()
        if not participant or not round_id or row.get("consent","").lower() not in ("true","1","yes"):
            raise ValueError("Cada respuesta requiere participant seudónimo, round y consent explícito.")
        key=(participant,round_id)
        if key in seen: raise ValueError("Hay respuestas duplicadas del mismo participante en una ronda.")
        seen.add(key); rounds.setdefault(round_id,[]).append(score(row))
    return {"source":str(Path(path).resolve()),"participants":len(rows),
            "rounds":{key:{"n":len(values),"mean":statistics.mean(values),"median":statistics.median(values),"sd":statistics.stdev(values) if len(values)>1 else None,"min":min(values),"max":max(values),"meets68":statistics.mean(values)>=68} for key,values in rounds.items()},
            "note":"SUS es una escala 0–100, no un porcentaje. No confirma WCAG ni causalidad entre rondas."}

if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("csv");p.add_argument("--output",required=True);a=p.parse_args()
    try: result=analyze(a.csv)
    except (ValueError,KeyError) as error: raise SystemExit(str(error)) from error
    out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding="utf-8")
    print(json.dumps(result,indent=2))
