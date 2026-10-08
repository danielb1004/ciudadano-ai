"""Generate the academic single-node AWS Kubernetes deployment from the base."""
import argparse, copy, json
from pathlib import Path
import yaml
p=argparse.ArgumentParser();p.add_argument("--host",required=True);p.add_argument("--tag",required=True);p.add_argument("--frontend-tag");p.add_argument("--nlp-tag");p.add_argument("--output",default="infrastructure/aws/generated.yaml");a=p.parse_args()
base=Path("infrastructure/kubernetes")
docs=[]
for f in ["namespace.yaml","configmap.yaml","services.yaml","platform.yaml","stateful-platform.yaml","hpa.yaml","network-policy.yaml"]:
 docs.extend(x for x in yaml.safe_load_all((base/f).read_text(encoding="utf-8")) if x)
docs=[x for x in docs if x["metadata"]["name"]!="beto-models"]
for d in docs:
 name=d["metadata"]["name"];kind=d["kind"]
 if kind=="ConfigMap" and name=="ciudadano-config":
  d["data"].update(PUBLIC_ORIGIN="https://"+a.host,DEPLOYMENT_MODE="academic",INSTITUTIONAL_MODE="mock",MODEL_VERSION="beto-synthetic-v1-onnx-fp32",BETO_RUNTIME="onnx",NLP_CPU_THREADS="2",LOG_LEVEL="warn")
 if kind in ["Deployment","StatefulSet"]:
  d["spec"]["replicas"]=1;spec=d["spec"]["template"]["spec"];c=spec["containers"][0]
  c["imagePullPolicy"]="IfNotPresent"
  if c["image"].startswith("ciudadano-ai/"): c["image"]=c["image"].split(":")[0]+":"+a.tag
  if name in ["conversation-service","catalog-service","recommendation-service","auth-service","audit-service"]:
   spec["initContainers"]=[{"name":"wait-postgres","image":c["image"],"imagePullPolicy":"IfNotPresent","command":["node","-e","const net=require('node:net');function check(){const s=net.createConnection({host:'postgres',port:5432});s.setTimeout(2000);s.on('connect',()=>{s.destroy();process.exit(0)});s.on('timeout',()=>s.destroy(new Error('timeout')));s.on('error',()=>{s.destroy();setTimeout(check,1000)})}check()"]}]
  if name=="nlp-service":
   c["image"]="ciudadano-ai/nlp-service:"+(a.nlp_tag or a.tag)
   c["envFrom"].append({"secretRef":{"name":"ciudadano-secrets"}})
   c["env"]=[{"name":"NLP_BACKEND","value":"beto"},{"name":"BETO_MODEL_PATH","value":"/models/beto-synthetic-v1"}]
   c["startupProbe"]={"httpGet":{"path":"/ready","port":8001},"periodSeconds":5,"failureThreshold":60}
   spec["volumes"]=[{"name":"models","hostPath":{"path":"/home/ubuntu/ciudadano-ai/ml/models","type":"Directory"}}]
   c["resources"]["limits"]={"cpu":"1500m","memory":"2Gi"}
  if name=="frontend":
   c["image"]="ciudadano-ai/frontend:"+(a.frontend_tag or a.tag)
   spec["volumes"]=[{"name":"nginx","configMap":{"name":"frontend-nginx"}}]
   c["volumeMounts"]=[{"name":"nginx","mountPath":"/etc/nginx/conf.d/default.conf","subPath":"default.conf","readOnly":True}]
  if name=="kong":
   for e in c["env"]:
    if e["name"]=="KONG_ADMIN_LISTEN":e["value"]="off"
  if name=="postgres": c["resources"]={"requests":{"cpu":"100m","memory":"256Mi"},"limits":{"cpu":"500m","memory":"768Mi"}}
  if name=="kafka":
   d["spec"]["strategy"]={"type":"Recreate"}
   for e in c["env"]:
    if e["name"]=="KAFKA_CONTROLLER_QUORUM_VOTERS":e["value"]="1@127.0.0.1:9093"
   c["env"] += [{"name":"KAFKA_HEAP_OPTS","value":"-Xms256m -Xmx512m"},{"name":"KAFKA_LOG_DIRS","value":"/tmp/kraft-combined-logs"}]
   c["resources"]={"requests":{"cpu":"100m","memory":"512Mi"},"limits":{"cpu":"750m","memory":"1Gi"}}
   c["volumeMounts"]=[{"name":"data","mountPath":"/tmp/kraft-combined-logs"}]
   spec["volumes"]=[{"name":"data","persistentVolumeClaim":{"claimName":"kafka-data"}}]
   spec["securityContext"]={"fsGroup":1000}
   probe={"exec":{"command":["/opt/kafka/bin/kafka-broker-api-versions.sh","--bootstrap-server","127.0.0.1:9092"]},"periodSeconds":15,"timeoutSeconds":10}
   c["startupProbe"]={**probe,"failureThreshold":30}
   c["readinessProbe"]={**probe,"failureThreshold":3}
 if kind=="Service" and name=="kafka":d["spec"]["ports"] += [{"name":"controller","port":9093,"targetPort":9093}];d["spec"]["ports"][0]["name"]="broker"
 if kind=="HorizontalPodAutoscaler":d["spec"].update(minReplicas=1,maxReplicas=3)
 if kind=="NetworkPolicy" and name=="ingress-gateway":
  d["spec"]["ingress"]=[{"from":[{"podSelector":{"matchLabels":{"app":"caddy"}}}]}]
def cm(name,data):return {"apiVersion":"v1","kind":"ConfigMap","metadata":{"name":name},"data":data}
kong=yaml.safe_load(Path("infrastructure/cloud/kong.yml").read_text())
for s in kong["services"]:
 s["url"]=s["url"].replace("http://"+s["name"]+":","http://"+s["name"]+"-service:")
docs.append(cm("kong-config",{"kong.yml":yaml.safe_dump(kong,sort_keys=False)}))
docs.append(cm("database-init",{"init.sql":Path("infrastructure/postgres/init.sql").read_text()}))
nginx=Path("infrastructure/cloud/nginx.conf").read_text().replace("set_real_ip_from 172.16.0.0/12;","set_real_ip_from 10.42.0.0/16;")
docs.append(cm("frontend-nginx",{"default.conf":nginx}))
docs.append(cm("caddy-config",{"Caddyfile":a.host+" {\n tls {\n protocols tls1.3\n }\n header {\n Strict-Transport-Security \"max-age=31536000\"\n -Server\n }\n reverse_proxy frontend:80 {\n header_up X-Forwarded-For {remote_host}\n }\n}\n"}))
for name,size in [("kafka-data","5Gi"),("caddy-data","1Gi")]:
 docs.append({"apiVersion":"v1","kind":"PersistentVolumeClaim","metadata":{"name":name},"spec":{"accessModes":["ReadWriteOnce"],"resources":{"requests":{"storage":size}}}})
docs.append({"apiVersion":"apps/v1","kind":"Deployment","metadata":{"name":"caddy"},"spec":{"replicas":1,"selector":{"matchLabels":{"app":"caddy"}},"template":{"metadata":{"labels":{"app":"caddy"}},"spec":{"containers":[{"name":"caddy","image":"caddy:2-alpine","ports":[{"containerPort":80},{"containerPort":443}],"resources":{"requests":{"cpu":"50m","memory":"64Mi"},"limits":{"cpu":"300m","memory":"256Mi"}},"volumeMounts":[{"name":"config","mountPath":"/etc/caddy"},{"name":"data","mountPath":"/data"}]}],"volumes":[{"name":"config","configMap":{"name":"caddy-config"}},{"name":"data","persistentVolumeClaim":{"claimName":"caddy-data"}}]}}}})
docs.append({"apiVersion":"v1","kind":"Service","metadata":{"name":"caddy"},"spec":{"type":"LoadBalancer","externalTrafficPolicy":"Local","selector":{"app":"caddy"},"ports":[{"name":"http","port":80,"targetPort":80},{"name":"https","port":443,"targetPort":443}]}})
docs.append({"apiVersion":"networking.k8s.io/v1","kind":"NetworkPolicy","metadata":{"name":"public-caddy"},"spec":{"podSelector":{"matchLabels":{"app":"caddy"}},"policyTypes":["Ingress"],"ingress":[{"ports":[{"port":80,"protocol":"TCP"},{"port":443,"protocol":"TCP"}]}]}})
for d in docs:
 if d["kind"]!="Namespace":d["metadata"]["namespace"]="ciudadano-ai"
out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(yaml.safe_dump_all(docs,sort_keys=False,allow_unicode=True),encoding="utf-8")
print(json.dumps({"resources":len(docs),"tag":a.tag,"host":a.host}))
