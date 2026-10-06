# syntax=docker/dockerfile:1
#
# Multi-stage build for the Stellaris Empire Planner (SvelteKit + adapter-node).
#
# better-sqlite3 (13+) ships Node-API binaries for glibc and musl inside its npm
# package, so no toolchain is needed in any stage; we stay on node:24-slim throughout.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable

# ── Build stage: full install (incl. dev deps) + production build ──────────────
FROM base AS build
WORKDIR /app
# pnpm-workspace.yaml carries `allowBuilds` (pnpm 11+ gates build scripts): it enables
# the esbuild/oxide installs and disables better-sqlite3's implicit node-gyp rebuild,
# which would otherwise replace its bundled binary with a from-source compile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
# Drop dev dependencies; better-sqlite3 and its bundled binary are a prod dependency.
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
