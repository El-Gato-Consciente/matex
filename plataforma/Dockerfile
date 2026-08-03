# --- Etapa 1: build estático (Vite) -----------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# La URL del backend se hornea EN BUILD (import.meta.env.VITE_COMPILE_API_URL).
# Local: http://localhost:8787 (el navegador del host habla con el backend expuesto).
# En AWS: pasar la URL pública del backend como build-arg.
ARG VITE_COMPILE_API_URL=http://localhost:8787
ENV VITE_COMPILE_API_URL=$VITE_COMPILE_API_URL
RUN npm run build

# --- Etapa 2: servir estático (como lo haría S3/CloudFront) -----------------
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
