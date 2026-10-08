#!/usr/bin/env bash
set -euo pipefail
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io curl ca-certificates python3 python3-yaml
sudo systemctl enable --now docker
if ! command -v k3s >/dev/null; then
  curl --fail --silent --show-error --location https://get.k3s.io -o /home/ubuntu/install-k3s.sh
  sha256sum /home/ubuntu/install-k3s.sh
  sudo env INSTALL_K3S_EXEC="server --disable traefik --write-kubeconfig-mode 600" sh /home/ubuntu/install-k3s.sh
fi
for attempt in $(seq 1 30); do
  if sudo k3s kubectl get nodes -o name | grep -q .; then break; fi
  sleep 2
done
sudo k3s kubectl wait --for=condition=Ready node --all --timeout=180s
sudo k3s kubectl get nodes -o wide
