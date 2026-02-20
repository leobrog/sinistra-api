# Stage 1: Download zeromq's prebuilt native binary using real Node.js
# (zeromq's postinstall script uses uv_async_init which Bun's Node shim doesn't support)
FROM node:20-slim AS zeromq-build
WORKDIR /build
RUN npm install zeromq@6.5.0 --ignore-scripts=false

# Stage 2: Runtime — Bun installs all deps from bun.lock, then we overlay
# zeromq's prebuilt binary from Stage 1
FROM oven/bun:1

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

# Replace zeromq with the Node-installed version (contains the prebuilt .node binary)
COPY --from=zeromq-build /build/node_modules/zeromq ./node_modules/zeromq

COPY . .

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["sh", "-c", "bun run src/database/migrate.ts && bun run src/main.ts"]
