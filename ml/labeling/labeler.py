"""CLI mínimo para importar, anonimizar, etiquetar y exportar consultas.
La asignación de revisores y desacuerdos se conserva en JSONL para auditoría."""
import argparse, csv, hashlib, json
from pathlib import Path
INTENTS = ["CONSULTA_INFORMATIVA", "SOLICITUD_TRAMITE", "VERIFICACION_ESTADO", "REPORTE_PROBLEMA", "DERIVACION_ENTIDAD"]
def anonymize(text):
    import re
    return re.sub(r"\b\d{6,12}\b", "[ID_REDACTED]", text)
def main():
    p=argparse.ArgumentParser(); sub=p.add_subparsers(dest="command",required=True)
    imp=sub.add_parser("import"); imp.add_argument("input"); imp.add_argument("output")
    lab=sub.add_parser("label"); lab.add_argument("input"); lab.add_argument("output"); lab.add_argument("--reviewer",required=True); lab.add_argument("--intent",choices=INTENTS,required=True)
    stat=sub.add_parser("stats"); stat.add_argument("input")
    a=p.parse_args()
    if a.command in ("import","label"):
        rows=list(csv.DictReader(open(a.input,encoding="utf-8"))); seen=set(); out=[]
        for row in rows:
            text=anonymize(row.get("text", "")); digest=hashlib.sha256(text.encode()).hexdigest()
            if digest in seen: continue
            seen.add(digest); row.update(text=text,duplicate=False)
            if a.command=="label": row.update(intent=a.intent,reviewer=a.reviewer,reviewStatus="pending")
            out.append(row)
        Path(a.output).parent.mkdir(parents=True,exist_ok=True); Path(a.output).write_text("\n".join(json.dumps(row,ensure_ascii=False) for row in out)+"\n",encoding="utf-8")
    else:
        rows=[json.loads(line) for line in open(a.input,encoding="utf-8") if line.strip()]; counts={intent:sum(row.get("intent")==intent for row in rows) for intent in INTENTS}; print(json.dumps({"total":len(rows),"distribution":counts},ensure_ascii=False))
if __name__=="__main__": main()
