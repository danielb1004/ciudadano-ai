"""Entrena TF-IDF + Logistic Regression con semilla fija; nunca se ejecuta al arrancar."""
import argparse, json
from pathlib import Path
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report
import joblib
def main():
    p=argparse.ArgumentParser(); p.add_argument("--data",default="ml/datasets/demo.csv"); p.add_argument("--output",default="ml/models/baseline.joblib"); p.add_argument("--metrics",default="research/evidence/baseline-metrics.json"); a=p.parse_args()
    frame=pd.read_csv(a.data); test_size=max(frame.intent.nunique(), int(len(frame)*.2)); train,test=train_test_split(frame,test_size=test_size,random_state=42,stratify=frame.intent)
    pipe=Pipeline([("tfidf",TfidfVectorizer(strip_accents="unicode",ngram_range=(1,2))), ("classifier",LogisticRegression(max_iter=1000,random_state=42))])
    model=GridSearchCV(pipe,{"classifier__C":[.5,1,2]},cv=2,scoring="f1_macro"); model.fit(train.text,train.intent); pred=model.predict(test.text)
    Path(a.output).parent.mkdir(parents=True,exist_ok=True); Path(a.metrics).parent.mkdir(parents=True,exist_ok=True); joblib.dump(model.best_estimator_,a.output)
    Path(a.metrics).write_text(json.dumps({"model":"tfidf-logistic-regression","seed":42,"bestParams":model.best_params_,"report":classification_report(test.intent,pred,output_dict=True,zero_division=0)},indent=2),encoding="utf-8")
if __name__=="__main__": main()
