# Despliegue

## Entorno académico

npm run setup y docker compose up --build -d. Frontend y gateway usan puertos locales; las bases y los servicios quedan en la red interna. Seis procesos, PLN por reglas y OTP/estado simulados. El esquema SQL se inicializa al crear el volumen; una base ya creada necesita aplicar el SQL idempotente manualmente.

## Kubernetes

La base incluye los seis servicios, frontend, Kong, PostgreSQL/Redis/Kafka de demostración, PVCs, probes, HPA y políticas de acceso entrante. Requiere metrics-server y un controlador ingress-nginx; adaptar nombre de namespace del controlador y CIDRs reales de proxies confiables. Las políticas requieren un CNI que las implemente.

Antes de kubectl apply -k infrastructure/kubernetes:

1. Construir/publicar imágenes inmutables y reemplazar latest. La imagen PLN de producción debe construirse con Dockerfile.beto.
2. Crear el Secret ciudadano-secrets desde un gestor. secrets.example.yaml no se aplica automáticamente y sus placeholders no son credenciales válidas. AES exige 64 caracteres hexadecimales; JWT/internal/audit necesitan claves distintas fuertes.
3. Configurar dominio, origen CORS, ingreso TLS 1.3 y certificado ciudadano-tls. Aplicar ssl-protocols: TLSv1.3 en el ConfigMap del controlador de ingreso que opera el clúster. Verificar negociación real; una referencia TLS en un manifiesto no demuestra versión.
4. Copiar el checkpoint BETO y tokenizer entrenados al PVC models. Sin pesos, /ready del PLN devuelve 503.
5. Para producción sustituir las bases internas de demostración por PostgreSQL gestionado y Redis/Kafka operados con autenticación, TLS, backups y retención. Cambiar endpoints y secretos; configurar POSTGRES_SSL_CA para PostgreSQL TLS. El Compose/base no constituye una plataforma de producción certificada.
6. Configurar OTP_DELIVERY_URL/TOKEN e INSTITUTIONAL_STATUS_URL/API_TOKEN con convenios reales. Su respuesta debe incluir ownerHash, state, updatedAt, entity y channel HTTPS oficial. El hash de titular usa IDENTITY_HASH_KEY independiente de JWT_SECRET y normalización trim/lowercase; acordar ese protocolo con el proveedor sin compartir la clave de firma JWT.
7. Probar migración, recuperación, derechos de datos, carga y ZAP en staging. El outbox y los cambios de estado no forman una única transacción; supervisar errores y reconciliación.

Para nodo PLN separado, agregar gpu-patch.yaml como parche estratégico en un overlay y preparar device plugin NVIDIA, nodos workload=nlp-gpu y taint correspondiente. El PVC debe admitir las réplicas/nodos elegidos. Ajustar memoria/CPU y cantidad de réplicas con mediciones.

TRUSTED_PROXIES solo debe abarcar proxies controlados. Kong usa Redis para el límite compartido. Impedir acceso público directo a servicios internos y no aceptar encabezados de IP de fuentes no confiables.

Rollback: regresar a imágenes por commit y revisar compatibilidad de esquemas/contratos; no borrar volúmenes para actualizar. Disponibilidad, backups, cifrado de transporte y comportamiento distribuido quedan pendientes de ejecución: Docker y kubectl no estaban disponibles en el equipo revisado.
