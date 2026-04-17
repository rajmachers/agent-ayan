FROM node:18-alpine AS builder

RUN apk add --no-cache ffmpeg

WORKDIR /app
COPY package*.json ./
RUN npm install --production=false
COPY . .
RUN npx tsc

FROM node:18-alpine

RUN apk add --no-cache ffmpeg curl
RUN addgroup -g 1001 -S ayan && adduser -S ayan -u 1001

WORKDIR /app
COPY --from=builder --chown=ayan:ayan /app/dist ./dist
COPY --from=builder --chown=ayan:ayan /app/node_modules ./node_modules
COPY --from=builder --chown=ayan:ayan /app/package.json ./

HEALTHCHECK --interval=30s --timeout=5s \
  CMD curl -f http://localhost:3004/health || exit 1

USER ayan
EXPOSE 3004
CMD ["node", "dist/index.js"]
