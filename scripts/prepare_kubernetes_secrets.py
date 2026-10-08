"""Create a Kubernetes Secret locally on the deployment host; never export keys."""
import argparse,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("--source",default=".env.cloud");a=p.parse_args()
values=dict(line.split("=",1) for line in Path(a.source).read_text().splitlines() if line and not line.startswith("#"))
keys=["JWT_SECRET","POSTGRES_PASSWORD","DATA_ENCRYPTION_KEY","INTERNAL_API_KEY","AUDIT_SIGNING_KEY","DEFAULT_ADMIN_PASSWORD","IDENTITY_HASH_KEY"]
secret={"apiVersion":"v1","kind":"Secret","metadata":{"name":"ciudadano-secrets","namespace":"ciudadano-ai"},"type":"Opaque","stringData":{k:values[k] for k in keys}}
subprocess.run(["sudo","k3s","kubectl","apply","-f","-"],input=json.dumps(secret).encode(),check=True)
