# Despliegue académico en AWS

Estado: desplegado en EC2 3.142.230.27 con Ubuntu 26.04 LTS y Kubernetes K3s. Los seis servicios, frontend, Kong, PostgreSQL, Redis, Kafka y Caddy están en ejecución. BETO utiliza ONNX FP32.

URL pública: https://ciudadano-ai.3-142-230-27.sslip.io

HTTPS activo con certificado válido de Let's Encrypt y TLS 1.3. Flujo de chat y privacidad comprobado contra la URL pública. Las evaluaciones adicionales de tiempos y cantidad de usuarios quedan para después. Detalle: [informe del despliegue](../reports/aws-deployment.md).

## Referencia para crear otra instancia EC2

1. Abrir EC2 en una región donde esté disponible m7i-flex.large (por ejemplo, us-east-1).
2. Configurar nombre ciudadano-ai, Ubuntu Server 24.04 LTS oficial de Canonical, arquitectura x86_64.
3. Seleccionar m7i-flex.large: 2 vCPU y 8 GiB. Es un punto de partida para el prototipo; no asegura cumplir la carga del Word. Evitar instancias micro para el conjunto de componentes.
4. Crear una clave SSH ciudadano-ai y guardar el archivo privado fuera del repositorio.
5. Configurar 50 GiB de almacenamiento gp3 cifrado.
6. Grupo de seguridad: TCP 22 desde Mi IP; TCP 80 y 443 desde Internet. Los servicios de aplicación y las bases permanecen internos. La API de Kubernetes (6443) no se expone a Internet.
7. Confirmar Free plan, créditos disponibles y estimación de costo de cómputo, disco e IPv4 antes de lanzar. La etiqueta Free tier eligible consume crédito y no significa funcionamiento ilimitado gratis. El costo mensual continuo puede exceder el presupuesto de US$20 cuando se agoten los créditos.
8. Tras iniciar, esperar ambos controles de estado y obtener la IP pública. Conectar como ubuntu usando SSH o EC2 Instance Connect según el acceso disponible.

## Etapas de instalación

- Transferir el estado actual del repositorio y el checkpoint entrenado por separado: hay cambios locales sin commit y los pesos están ignorados por Git. Clonar solamente el remoto no reproduce el proyecto actual.
- Construir imágenes por revisión y usar Kubernetes K3s para ejecutar los seis servicios, Kong, PostgreSQL, Redis y Kafka. Adaptar los manifiestos al ingreso de K3s, volúmenes, DNS y secretos. Los manifiestos base actuales necesitan esos ajustes; no ejecutarlos sin adaptación.
- Configurar dominio, certificado y TLS 1.3; separar claves de JWT, auditoría, cifrado y acceso interno.
- Verificar el checkpoint BETO antes de activar su versión optimizada: el reporte INT8 disponible registra una discrepancia de calidad, por lo que no constituye un modelo aprobado para despliegue. El checkpoint original tiene evaluación sintética disponible.
- Instalar y verificar metrics-server y HPA al 70%; las réplicas se limitan a la capacidad del nodo. Un solo nodo no prueba tolerancia a la pérdida del servidor.
- Ejecutar conversaciones, persistencia, recuperación, JMeter, ZAP y accesibilidad. Registrar hardware, revisión, configuración, tiempos y errores.

## Correspondencia con el Word

El despliegue debe conservar Kubernetes, los servicios y la infraestructura descritos. Docker Compose sirve para un arranque alternativo, pero no demuestra HPA. La disponibilidad del 99,5%, la carga de 500 usuarios y la latencia deben medirse. Las muestras sintéticas no sustituyen el corpus original ni las pruebas SUS con participantes reales.

## Costos y apagado

Detener EC2 cuando no se utilice reduce cómputo, pero EBS y otros recursos pueden seguir consumiendo crédito. Guardar respaldo antes de terminar una instancia; no borrar volúmenes como procedimiento de actualización. Revisar créditos y consumo en Billing. Permanecer en Free plan evita pasar voluntariamente a facturación por uso.

Fuentes oficiales:
- https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html
- https://docs.aws.amazon.com/ec2/latest/instancetypes/gp.html
- https://docs.k3s.io/installation/requirements
