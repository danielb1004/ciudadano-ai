# Instalación

Seguir el inicio rápido del README: Node 24, Python 3.12, npm ci, npm run setup, entorno .venv, pip del archivo requirements y npm run dev.

setup crea secretos aleatorios y agrega claves faltantes sin sobrescribir valores existentes. Reemplazar cualquier placeholder o contraseña antigua que ya exista antes de producción. Nunca publicar .env.

Desarrollo sin Docker: USE_INFRASTRUCTURE=false, datos en memoria, NLP_BACKEND=rules, INSTITUTIONAL_MODE=mock. Vite enruta /api/v1 a los puertos de los seis servicios. Los puertos deben estar libres.

Compose: docker compose up --build -d inicia toda la plataforma. No levantar además npm run dev. PostgreSQL ejecuta init.sql al crear su volumen; en una base preexistente aplicar ese SQL idempotente antes de actualizar.

Para verificaciones instalar testing/requirements.txt. Para BETO instalar ml/requirements-training.txt en un entorno dedicado: necesita más memoria, espacio y descarga del modelo base.
