# Manual de despliegue

Desarrollo: `cp .env.example .env`, `docker compose up -d`, `npm install`, `npm run dev`. Pruebas: construir imágenes etiquetadas por commit, configurar secretos desde un gestor y ejecutar smoke/contratos/JMeter/ZAP. Producción: usar Kubernetes con imágenes inmutables, `kubectl apply -k infrastructure/kubernetes`, un Ingress con certificado TLS 1.3, PostgreSQL gestionado con backups, Redis/Kafka con persistencia y observabilidad.

Rollback: volver a la imagen/tag anterior con `kubectl rollout undo deployment/conversation-service`; escalar con HPA; nunca commitear `secrets.example.yaml` con valores reales. El manifiesto incluido es base inicial y debe extenderse a los cinco servicios restantes antes de producción.
