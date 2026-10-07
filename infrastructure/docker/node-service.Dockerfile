FROM node:22-alpine
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY shared ./shared
COPY services ./services
RUN npm install --ignore-scripts
ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}
CMD npm run dev --workspace services/${SERVICE_NAME}
