FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 80

ENV PORT=80
ENV BACKEND_URL=http://backend:8000

CMD ["node", "server.js"]
