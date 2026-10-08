FROM node:24-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared ./shared
COPY services ./services
COPY frontend ./frontend
RUN npm ci --ignore-scripts
RUN npm run build --workspace frontend
FROM nginx:1.27-alpine
COPY --from=build /workspace/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

COPY frontend/security-headers.conf /etc/nginx/conf.d/security-headers.inc
