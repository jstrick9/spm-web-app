# ============================================================
# Wedding venue POC — single-container build
# ============================================================
# Multi-stage:
#   1. build-client → React bundle
#   2. build-server → compiled TypeScript
#   3. runtime      → tiny Alpine + native sqlite + the two built artifacts
#
# Final image is ~120 MB and starts in <1 second.
# ============================================================

# ─── Stage 1: client ────────────────────────────────────────
FROM node:20-alpine AS build-client
WORKDIR /build
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ─── Stage 2: server ────────────────────────────────────────
FROM node:20-alpine AS build-server
WORKDIR /build
# build-base + python3 needed to compile better-sqlite3's native binding
RUN apk add --no-cache python3 make g++
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ─── Stage 3: runtime ───────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache tini
ENV NODE_ENV=production
ENV WEDDING_DB_PATH=/data/wedding.db
ENV WEDDING_UPLOADS_PATH=/data/uploads
ENV PORT=3000

# Server: prod dependencies only + compiled JS
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY --from=build-server /build/dist        ./server/dist
# SQL migrations are loaded at runtime by dist/db/migrate.js. TypeScript does
# not copy non-code assets into dist, so include them explicitly or a fresh
# production container cannot initialize its SQLite database.
COPY --from=build-server /build/src/db/migrations ./server/dist/db/migrations
COPY --from=build-server /build/src/db/schema.sql ./server/src/db/schema.sql

# Client: built static assets
COPY --from=build-client /build/dist ./client/dist

# Persistent volume for the SQLite file + uploads
VOLUME /data

EXPOSE 3000
# `tini` reaps zombies cleanly so SIGTERM closes the DB properly
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "node server/dist/db/migrate.js && node server/dist/index.js"]
