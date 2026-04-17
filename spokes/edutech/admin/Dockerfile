FROM node:18-alpine

RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-workspace.yaml ./
COPY spokes/tsconfig.json ./spokes/tsconfig.json
COPY hub/sdk/types ./hub/sdk/types
COPY hub/sdk/service-sdk ./hub/sdk/service-sdk
COPY hub/sdk/client-sdk ./hub/sdk/client-sdk
COPY spokes/edutech/admin ./spokes/edutech/admin

RUN pnpm install --no-frozen-lockfile \
  --filter @ayan/types \
  --filter @ayan/client-sdk \
  --filter @ayan/service-sdk \
  --filter @ayan/spoke-edutech-admin

WORKDIR /workspace/spokes/edutech/admin
EXPOSE 3000
CMD ["pnpm", "exec", "next", "dev", "-H", "0.0.0.0", "-p", "3000"]
