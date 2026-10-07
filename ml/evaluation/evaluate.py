import argparse, json, time
from pathlib import Path
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from services_nlp_adapter import predict
def main():
    p=argparse.ArgumentParser(); p.add_argument("--data",required=True); p.add_argument("--output",required=True); a=p.parse_args(); frame=pd.read_csv(a.data)
    labels=sorted(frame.intent.unique()); test_size=max(len(labels), int(len(frame)*.3)); _,test=train_test_split(frame,test_size=test_size,random_state=42,stratify=frame.intent); start=time.perf_counter(); pred=[predict(text) for text in test.text]; elapsed=(time.perf_counter()-start)*1000
    report=classification_report(test.intent,pred,labels=labels,output_dict=True,zero_division=0); result={"dataset":a.data,"seed":42,"sampleCount":len(test),"accuracy":accuracy_score(test.intent,pred),"f1Macro":f1_score(test.intent,pred,labels=labels,average="macro",zero_division=0),"f1Micro":f1_score(test.intent,pred,labels=labels,average="micro",zero_division=0),"perCategory":report,"confusionMatrix":confusion_matrix(test.intent,pred,labels=labels).tolist(),"labels":labels,"inferenceTimeMs":{"mean":elapsed/max(len(test),1)}}
    Path(a.output).parent.mkdir(parents=True,exist_ok=True); Path(a.output).write_text(json.dumps(result,indent=2),encoding="utf-8")
if __name__=="__main__": main()
