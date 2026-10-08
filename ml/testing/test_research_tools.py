import csv, importlib.util, json
from pathlib import Path
import pytest

def load(path,name):
    spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
prepare=load("ml/training/prepare_splits.py","splits")
sus=load("research/sus/analyze_sus.py","sus")
load_results=load("testing/jmeter/analyze.py","load_results")
def make_corpus(path):
    with path.open("w",encoding="utf-8",newline="") as stream:
        writer=csv.DictWriter(stream,fieldnames=["text","intent"]);writer.writeheader()
        for intent in prepare.INTENTS:
            for i in range(8):writer.writerow({"text":intent+" consulta "+str(i),"intent":intent})

def test_fixed_disjoint_splits(tmp_path):
    source=tmp_path/"corpus.csv";make_corpus(source)
    first=prepare.prepare(source,tmp_path/"a");second=prepare.prepare(source,tmp_path/"b")
    assert first["splitCounts"]==second["splitCounts"]
    sets=[set((tmp_path/"a"/(name+".csv")).read_text(encoding="utf-8").splitlines()[1:]) for name in ("train","validation","test")]
    assert not sets[0]&sets[1] and not sets[0]&sets[2] and not sets[1]&sets[2]

def test_small_corpus_cannot_claim_academic(tmp_path):
    source=tmp_path/"corpus.csv";make_corpus(source)
    with pytest.raises(ValueError):prepare.prepare(source,tmp_path/"splits",academic=True)

def test_sus_standard_scoring_and_invalid_answers():
    row={f"q{i}":5 if i%2 else 1 for i in range(1,11)}
    assert sus.score(row)==100
    row["q1"]=6
    with pytest.raises(ValueError):sus.score(row)
    row["q1"]=float("nan")
    with pytest.raises(ValueError):sus.score(row)

def test_empty_sus_does_not_generate_results(tmp_path):
    source=tmp_path/"responses.csv";source.write_text("participant,round,consent\n",encoding="utf-8")
    with pytest.raises(ValueError):sus.analyze(source)

def test_load_analysis_requires_actual_messages(tmp_path):
    source=tmp_path/"load.jtl";source.write_text("label,elapsed,timeStamp,success,allThreads\nprofile,3,1000,true,1\n",encoding="utf-8")
    with pytest.raises(ValueError):load_results.summarize(source)
    source.write_text("label,elapsed,timeStamp,success,allThreads\nmessage,100,1000,true,2\nmessage,300,1200,false,2\n",encoding="utf-8")
    result=load_results.summarize(source)
    assert result["meanMs"]==200 and result["errorRate"]==.5 and result["cpu"] is None
