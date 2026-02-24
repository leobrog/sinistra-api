# Stage 1: Install zeromq native binary using Node.js
# (zeromq uses uv_async_init which Bun doesn't support on POSIX)
FROM node:22-slim AS zeromq-build
WORKDIR /build
RUN npm install zeromq@6.5.0 --ignore-scripts=false

# Stage 2: Runtime — node:22-slim base with Bun installed on top
# Node is needed to run the EDDN worker (zeromq), Bun runs everything else.
FROM node:22-slim

# Install Bun via the official npm package
RUN npm install -g bun

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

# Replace zeromq with the Node-installed version (contains the prebuilt .node binary)
COPY --from=zeromq-build /build/node_modules/zeromq ./node_modules/zeromq

COPY . .

RUN mkdir -p /app/data

EXPOSE 3000

# Run migrations, then start the EDDN worker (Node) and the main server (Bun) in parallel.
# The EDDN worker writes to the shared SQLite DB; the main server handles the API.
CMD ["sh", "-c", "bun run src/database/migrate.ts && node scripts/eddn-worker.mjs & bun run src/main.ts"]
