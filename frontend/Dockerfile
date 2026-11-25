# Stage 1: Build Vite React App
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Serve with Nginx (Debian-based for 100% CentOS 7 / Linux 3.10 kernel compatibility)
FROM nginx:1.27-bookworm-slim

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
