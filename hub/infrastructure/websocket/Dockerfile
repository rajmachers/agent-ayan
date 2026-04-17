FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --production=false
COPY . .
RUN npx tsc

FROM node:18-alpine
RUN addgroup -g 1001 -S ayan && adduser -S ayan -u 1001
WORKDIR /app
COPY --from=builder --chown=ayan:ayan /app/dist ./dist
COPY --from=builder --chown=ayan:ayan /app/node_modules ./node_modules
COPY --from=builder --chown=ayan:ayan /app/package.json ./
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
USER ayan
EXPOSE 3000
CMD ["node", "dist/index.js"]
