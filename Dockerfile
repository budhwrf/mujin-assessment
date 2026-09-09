ARG BASE_IMAGE=debian:bullseye
FROM ${BASE_IMAGE} AS node

ENV DEBIAN_FRONTEND=noninteractive

RUN printf '%s\n' \
      'deb http://archive.debian.org/debian bullseye main' \
      > /etc/apt/sources.list \
  && rm -f /etc/apt/sources.list.d/* \
  && printf 'Acquire::Check-Valid-Until "false";\n' > /etc/apt/apt.conf.d/99no-check-valid-until \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl xz-utils \
  && rm -rf /var/lib/apt/lists/*

ARG NODE_VERSION=22.18.0
ARG TARGETARCH

RUN set -eu; \
  case "${TARGETARCH}" in \
    amd64) NODE_ARCH=x64 ;; \
    arm64) NODE_ARCH=arm64 ;; \
    *) echo "Unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
  esac; \
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz" \
    | tar -xJ -C /usr/local --strip-components=1; \
  corepack enable; \
  corepack prepare pnpm@10.14.0 --activate

FROM node AS build

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY tsconfig.base.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json
COPY packages/map-domain/package.json packages/map-domain/package.json

RUN pnpm install --frozen-lockfile --filter frontend... --filter backend...

COPY apps/frontend apps/frontend
COPY apps/backend apps/backend
COPY packages/map-domain packages/map-domain

RUN pnpm --filter @mujin/map-domain build \
  && pnpm --filter frontend build \
  && pnpm --filter backend build \
  && pnpm --filter=backend deploy --prod --legacy /prod \
  && rm -rf /prod/dist \
  && cp -a apps/backend/dist /prod/dist \
  && mkdir -p /prod/public \
  && cp -a apps/frontend/dist/. /prod/public/

ARG BASE_IMAGE=debian:bullseye
FROM ${BASE_IMAGE} AS runtime

ENV DEBIAN_FRONTEND=noninteractive \
  NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=3000 \
  MAPS_DIR=/tmp/data \
  STATIC_DIR=/app/public

RUN printf '%s\n' \
      'deb http://archive.debian.org/debian bullseye main' \
      > /etc/apt/sources.list \
  && rm -f /etc/apt/sources.list.d/* \
  && printf 'Acquire::Check-Valid-Until "false";\n' > /etc/apt/apt.conf.d/99no-check-valid-until \
  && apt-get update \
  && apt-get upgrade -y --no-install-recommends \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 1001 --create-home app

# Runtime only needs the node binary. npm, npx, and corepack are build tools
# and pull vulnerable packages such as tar and pacote into the image.
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=build --chown=app:app /prod /app

WORKDIR /app

USER app

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
