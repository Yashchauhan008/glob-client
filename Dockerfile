FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Vite bakes VITE_* in at build time and only reads .env.production in build mode,
# so .env.prod is what production gets (the local .env is excluded by .dockerignore).
RUN test -f .env.prod || (echo "ERROR: .env.prod is missing" && exit 1)
RUN cp .env.prod .env.production
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.config /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
