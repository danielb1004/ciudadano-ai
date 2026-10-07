"""Calcula SUS 0-100 desde CSV con diez columnas q1..q10 (1-5)."""
import argparse
from pathlib import Path
import pandas as pd
def score(row):
    values=[float(row[f"q{i}"]) for i in range(1,11)]
    return sum((v-1 if i%2 else 5-v) for i,v in enumerate(values,1))*2.5
def main():
    p=argparse.ArgumentParser(); p.add_argument("csv"); p.add_argument("--output",required=True); a=p.parse_args(); df=pd.read_csv(a.csv); df["sus"]=df.apply(score,axis=1); summary=df.sus.describe(percentiles=[.25,.5,.75,.95]).to_dict(); Path(a.output).parent.mkdir(parents=True,exist_ok=True); pd.DataFrame([summary]).to_csv(a.output,index=False); print(summary)
if __name__=="__main__": main()
