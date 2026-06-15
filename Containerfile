# syntax=docker/dockerfile:1
#
# Multi-stage build for the Stellaris Empire Planner (SvelteKit + adapter-node).
#
# Debian-based images are used deliberately: better-sqlite3 is a native module and
# its prebuilt binaries / source build target glibc. Alpine (musl) would force an
# awkward from-source rebuild, so we stay on node:24-slim throughout.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable

# ── Build stage: full install (incl. dev deps) + production build ──────────────
FROM base AS build
WORKDIR /app
# Toolchain so better-sqlite3 can compile if no prebuilt binary matches this platform.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
# pnpm-workspace.yaml carries `allowBuilds` (pnpm 11 gates build scripts); it must be
# present for better-sqlite3's native build to run during install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
# Drop dev dependencies; the already-compiled better-sqlite3 binding is kept.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm prune --prod

# ── Runtime stage: lean image, just Node + server bundle + prod deps + DB ───────
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    STELLARIS_DB=/app/data/stellaris.sqlite

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Bundle the extracted game DB so the image is self-contained. Override at runtime
# by setting STELLARIS_DB and mounting a different file (e.g. -v db.sqlite:/data/db:ro).
COPY data/stellaris.sqlite ./data/stellaris.sqlite

EXPOSE 3000
USER node
CMD ["node", "build"]
