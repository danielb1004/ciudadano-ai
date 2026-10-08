FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY frontend/package.json ./frontend/package.json
COPY shared ./shared
COPY services ./services
RUN npm ci --ignore-scripts
ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}
CMD npm run start --workspace services/${SERVICE_NAME}
