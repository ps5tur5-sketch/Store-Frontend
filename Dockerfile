FROM node:24-alpine AS build
WORKDIR /app
ENV NPM_CONFIG_MAXSOCKETS=1 \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=1000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=5000 \
    NPM_CONFIG_FETCH_TIMEOUT=30000
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /entrypoint.sh
COPY --from=build /app/dist /usr/share/nginx/html
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
