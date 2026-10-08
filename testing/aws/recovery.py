"""Controlled recovery check on the authorized AWS academic deployment."""
import argparse,json,subprocess,time
from pathlib import Path
import httpx
p=argparse.ArgumentParser();p.add_argument("--base",default="http://127.0.0.1:18081");p.add_argument("--key",required=True);a=p.parse_args()
checks=[];clients=[]
def ssh(command):
 r=subprocess.run(["ssh","-i",a.key,"-o","BatchMode=yes","ubuntu@3.142.230.27",command],capture_output=True,text=True,timeout=180)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout
def request(client,method,path,expected=200,**kwargs):
 for attempt in range(3):
  r=client.request(method,path,**kwargs)
  if r.status_code!=429:break
  time.sleep(min(61,int(r.headers.get("retry-after","60"))+1))
 assert r.status_code==expected,(path,r.status_code,r.text[:200])
 return r.json() if r.content else {}
def profile():
 c=httpx.Client(base_url=a.base,timeout=20);r=request(c,"POST","/api/v1/profiles",201,json={});c.headers["Authorization"]="Bearer "+r["accessToken"];clients.append((c,r["id"]));return c,r["id"]
try:
 c,owner=profile();other,other_id=profile()
 request(c,"POST","/api/v1/conversations",403,json={});checks.append("consent_required")
 request(c,"POST",f"/api/v1/profiles/{owner}/consents",201,json={"purpose":"conversation_context","version":"1.0","granted":True})
 session=request(c,"POST","/api/v1/conversations",201,json={})["conversationId"]
 first=request(c,"POST",f"/api/v1/conversations/{session}/messages",json={"message":"Necesito sacar el pasaporte en Bogotá"})
 assert first["intent"]!="UNAVAILABLE" and first["recommendations"];checks.append("beto_and_catalog")
 request(other,"GET",f"/api/v1/profiles/{owner}/export",403);checks.append("ownership_enforced")
 ssh("sudo k3s kubectl -n ciudadano-ai rollout restart deployment/conversation-service >/dev/null; sudo k3s kubectl -n ciudadano-ai rollout status deployment/conversation-service --timeout=120s")
 after=request(c,"POST",f"/api/v1/conversations/{session}/messages",json={"message":"¿Cuáles son los requisitos?"})
 assert after["recommendations"] and "pasaporte" in after["response"].lower();checks.append("session_survives_process_restart")
 try:
  ssh("sudo k3s kubectl -n ciudadano-ai scale deployment/nlp-service --replicas=0 >/dev/null; sudo k3s kubectl -n ciudadano-ai wait --for=delete pod -l app=nlp-service --timeout=90s")
  fallback=request(c,"POST",f"/api/v1/conversations/{session}/messages",json={"message":"Necesito sacar el pasaporte"})
  assert fallback["intent"]=="UNAVAILABLE" and fallback["requiresReferral"];checks.append("nlp_failure_referral")
 finally:
  ssh("sudo k3s kubectl -n ciudadano-ai scale deployment/nlp-service --replicas=1 >/dev/null; sudo k3s kubectl -n ciudadano-ai rollout status deployment/nlp-service --timeout=120s")
 recovered=request(c,"POST",f"/api/v1/conversations/{session}/messages",json={"message":"Necesito sacar el pasaporte en Bogotá"})
 assert recovered["intent"]!="UNAVAILABLE" and recovered["recommendations"];checks.append("nlp_recovery")
 dossier=request(c,"GET",f"/api/v1/profiles/{owner}/export");assert dossier["citizenData"]["profileId"]==owner;checks.append("export_after_recovery")
finally:
 for c,owner in clients:
  try:request(c,"DELETE",f"/api/v1/profiles/{owner}/data")
  finally:c.close()
out=Path("research/evidence/aws-recovery.json");out.write_text(json.dumps({"environment":"AWS Kubernetes via private SSH tunnel","checks":checks,"passed":len(checks)},indent=2),encoding="utf-8");print(json.dumps({"passed":len(checks),"checks":checks}))
