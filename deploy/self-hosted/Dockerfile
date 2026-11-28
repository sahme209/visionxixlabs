# V19 self-hosted image: the web app and API (the cockpit, the Agent service and the desktop app's server).
# Built from this repository; no secret is baked in. Configuration comes from the environment at run time.
FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
# Dependencies first so they are cached between source changes. postinstall generates the Prisma client.
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts tsconfig*.json ./
COPY scripts/run-native-typecheck.mjs ./scripts/run-native-typecheck.mjs
RUN npm ci --no-audit --no-fund
COPY . .
RUN NODE_OPTIONS=--max-old-space-size=10240 npm run build

FROM node:24.21.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
# Prisma's schema tools (used by the database setup step) need OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN groupadd --system v19 && useradd --system --gid v19 --home /app v19
COPY --from=build --chown=v19:v19 /app /app
USER v19
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
