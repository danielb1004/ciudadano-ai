"""Train the baseline on the same train/validation/test partition as BETO."""
import argparse, json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"services/nlp-service/app"))
from preprocessing import normalize
import pandas as pd
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--splits",default="ml/datasets/splits")
    p.add_argument("--output",default="ml/models/baseline.joblib")
    p.add_argument("--metrics",default="research/evidence/baseline-metrics.json")
    a=p.parse_args()
    splits=Path(a.splits)
    manifest=json.loads((splits/"manifest.json").read_text(encoding="utf-8"))
    train,validation,test=[pd.read_csv(splits/f"{name}.csv") for name in ("train","validation","test")]
    for frame in (train,validation,test): frame["text"]=frame["text"].map(normalize)
    candidates=[]
    for c in (.5,1,2):
        model=Pipeline([("tfidf",TfidfVectorizer(strip_accents="unicode",ngram_range=(1,2))),("classifier",LogisticRegression(C=c,max_iter=1000,random_state=manifest["seed"]))])
        model.fit(train.text,train.intent)
        candidates.append((f1_score(validation.intent,model.predict(validation.text),average="macro",zero_division=0),c,model))
    _,c,model=max(candidates,key=lambda item:item[0])
    prediction=model.predict(test.text)
    labels=manifest["classes"]
    result={"model":"TF-IDF + Logistic Regression","academic":manifest["academic"],"dataset":manifest,"bestC":c,"sampleCount":len(test),"accuracy":accuracy_score(test.intent,prediction),"f1Macro":f1_score(test.intent,prediction,average="macro",zero_division=0),"perCategory":classification_report(test.intent,prediction,labels=labels,output_dict=True,zero_division=0),"confusionMatrix":confusion_matrix(test.intent,prediction,labels=labels).tolist(),"labels":labels}
    Path(a.output).parent.mkdir(parents=True,exist_ok=True)
    Path(a.metrics).parent.mkdir(parents=True,exist_ok=True)
    joblib.dump(model,a.output)
    Path(a.metrics).write_text(json.dumps(result,indent=2),encoding="utf-8")
if __name__=="__main__": main()
