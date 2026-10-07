import argparse
from pathlib import Path
import pandas as pd
def main():
    p=argparse.ArgumentParser(); p.add_argument("csv"); p.add_argument("--output",required=True); a=p.parse_args(); df=pd.read_csv(a.csv); numeric=[c for c in ["sus","duration_seconds","failed_attempts","recoveries"] if c in df]; result=df.groupby("round")[numeric].agg(["mean","median","std"]).to_json(); Path(a.output).parent.mkdir(parents=True,exist_ok=True); Path(a.output).write_text(result,encoding="utf-8"); print(result)
if __name__=="__main__": main()
