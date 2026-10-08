import json,time
from pathlib import Path
import httpx
key=Path(".tools/zap-state/key.txt").read_text().strip()
base="http://127.0.0.1:18081"
api=httpx.Client(base_url="http://127.0.0.1:8090",timeout=20)
def call(path,params=None):
 r=api.get("/JSON/"+path+"/",params={"apikey":key,**(params or {})})
 if r.status_code!=200:raise RuntimeError("ZAP API status "+str(r.status_code))
 return r.json()
version=call("core/view/version")["version"]
with httpx.Client(proxy="http://127.0.0.1:8090",trust_env=False,timeout=20) as client:
 for path in ["/","/chat","/tramites","/privacidad","/admin","/api/v1/procedures","/api/v1/entities","/api/v1/categories","/api/v1/models/current"]:
  r=client.get(base+path);assert r.status_code==200,(path,r.status_code)
for _ in range(30):
 if int(call("pscan/view/recordsToScan")["recordsToScan"])==0:break
 time.sleep(1)
alerts=call("core/view/alerts",{"baseurl":base,"start":0,"count":200})["alerts"]
result={"scanner":"OWASP ZAP","version":version,"mode":"passive","environment":"AWS through private SSH tunnel; public HTTPS pending","target":base,"alerts":[{k:x.get(k) for k in ["alert","risk","confidence","url","cweid","solution"]} for x in alerts],"highRiskCount":sum(x.get("risk")=="High" for x in alerts)}
Path("research/evidence/aws-zap-passive.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
print(json.dumps({"version":version,"alertCount":len(alerts),"highRiskCount":result["highRiskCount"],"risks":[x.get("risk") for x in alerts]}))
