"""Summarize a real JMeter CSV JTL; never infer unrecorded resource usage."""
import argparse, csv, json, statistics
from pathlib import Path
def summarize(path, warmup_seconds=0):
    with Path(path).open(encoding="utf-8-sig",newline="") as stream:
        rows=[row for row in csv.DictReader(stream) if row.get("label") == "message"]
    if not rows: raise ValueError("El JTL no contiene muestras message.")
    origin=min(float(row["timeStamp"]) for row in rows)
    rows=[row for row in rows if float(row["timeStamp"])>=origin+warmup_seconds*1000]
    if not rows: raise ValueError("No hay muestras despues del calentamiento.")
    latency=sorted(float(row["elapsed"]) for row in rows)
    start=min(float(row["timeStamp"]) for row in rows)
    end=max(float(row["timeStamp"])+float(row["elapsed"]) for row in rows)
    errors=sum(row["success"].lower()!="true" for row in rows)
    percentile=lambda q:latency[min(len(latency)-1,int((len(latency)-1)*q))]
    return {"source":str(Path(path).resolve()),"warmupSeconds":warmup_seconds,"sampleCount":len(rows),"meanMs":statistics.mean(latency),"p50Ms":percentile(.5),"p95Ms":percentile(.95),"p99Ms":percentile(.99),"errorCount":errors,"errorRate":errors/len(rows),"throughputPerSecond":len(rows)/max((end-start)/1000,.001),"peakReportedThreads":max(int(row.get("allThreads") or 0) for row in rows),"cpu":None,"memory":None,"note":"CPU y memoria requieren exportación separada del monitoreo; threads no prueba 500 conexiones simultáneas."}
if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--jtl",required=True);parser.add_argument("--warmup-seconds",type=float,default=60);parser.add_argument("--output",default="research/evidence/load-results.json");args=parser.parse_args()
    try:result=summarize(args.jtl,args.warmup_seconds)
    except ValueError as error:raise SystemExit(str(error)) from error
    out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,indent=2),encoding="utf-8")
    print(json.dumps(result,indent=2))
