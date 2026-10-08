# Despliegue físico

Desarrollo: cinco procesos Node, un proceso FastAPI y Vite; datos en memoria y auditoría HTTP interna.

Compose académico: frontend Nginx → Kong → seis servicios. PostgreSQL, Redis y Kafka permanecen internos con volúmenes. Bases y broker usan conexiones de red académicas; no se atribuye seguridad de producción a este entorno.

Kubernetes: deployments de los seis servicios, HPA CPU 70%, frontend/Kong, PVC de modelos y políticas de ingreso. La base trae plataforma de demostración; producción necesita reemplazarla por servicios gestionados/operados, TLS, secretos, backups y monitoreo. Nodo GPU separado opcional mediante gpu-patch.yaml. Manual: docs/manuals/deployment.md.

No se ejecutó un despliegue Docker/Kubernetes en el equipo revisado.
