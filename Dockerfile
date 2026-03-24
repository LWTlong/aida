FROM node:18-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

ENTRYPOINT ["node", "dist/mcp/server.js"]
