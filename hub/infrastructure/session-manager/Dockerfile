FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY server.js .

RUN addgroup -g 1001 -S ayan && adduser -S ayan -u 1001
USER ayan

EXPOSE 8181

HEALTHCHECK --interval=30s --timeout=5s \
  CMD node -e "const ws = new (require('ws'))('ws://localhost:8181'); ws.on('open', () => { ws.close(); process.exit(0); }); ws.on('error', () => process.exit(1)); setTimeout(() => process.exit(1), 3000);"

CMD ["node", "server.js"]
