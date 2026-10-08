#!/usr/bin/env bash
set -euo pipefail
cd /home/ubuntu
mkdir -p ciudadano-ai
tar -xzf aws-source.tar.gz -C ciudadano-ai
tar -xf aws-model.tar -C ciudadano-ai
cd ciudadano-ai
umask 077
TAG="${AWS_IMAGE_TAG:-aws-$(date -u +%Y%m%d%H%M%S)}"
python3 scripts/generate_aws_manifests.py --host ciudadano-ai.3-142-230-27.sslip.io --tag "$TAG"
if [ ! -f .env.cloud ]; then python3 scripts/prepare_cloud.py --origin https://ciudadano-ai.3-142-230-27.sslip.io; fi
sudo k3s kubectl create namespace ciudadano-ai --dry-run=client -o yaml | sudo k3s kubectl apply -f -
python3 scripts/prepare_kubernetes_secrets.py
sudo k3s kubectl apply --dry-run=server -f infrastructure/aws/generated.yaml
for service in conversation catalog recommendation auth audit; do
 sudo docker build -f infrastructure/docker/node-service.Dockerfile --build-arg SERVICE_NAME=${service}-service -t ciudadano-ai/${service}-service:$TAG .
 sudo docker save ciudadano-ai/${service}-service:$TAG | sudo k3s ctr images import -
done
sudo docker build -f services/nlp-service/Dockerfile.onnx -t ciudadano-ai/nlp-service:$TAG .
sudo docker save ciudadano-ai/nlp-service:$TAG | sudo k3s ctr images import -
sudo docker build -f frontend/Dockerfile -t ciudadano-ai/frontend:$TAG .
sudo docker save ciudadano-ai/frontend:$TAG | sudo k3s ctr images import -
sudo k3s kubectl apply -f infrastructure/aws/generated.yaml
sudo k3s kubectl -n ciudadano-ai rollout status statefulset/postgres --timeout=300s
sudo k3s kubectl -n ciudadano-ai exec -i statefulset/postgres -- psql -v ON_ERROR_STOP=1 -U ciudadano -d ciudadano_ai < infrastructure/postgres/init.sql
for service in redis kafka nlp-service catalog-service recommendation-service auth-service audit-service conversation-service kong frontend caddy; do
 sudo k3s kubectl -n ciudadano-ai rollout status deployment/$service --timeout=600s
done
sudo k3s kubectl -n ciudadano-ai get pods,svc,hpa,pvc
echo DEPLOYMENT_COMPLETED
