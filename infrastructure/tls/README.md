# TLS 1.3

Los certificados no se guardan en Git. En desarrollo se puede usar un certificado local; en Kubernetes se crea `ciudadano-tls` desde el gestor de secretos o cert-manager. El proxy debe restringir `ssl_protocols TLSv1.3` y deshabilitar HTTP en producción. La terminación TLS en Kong/Ingress es un control de infraestructura.
