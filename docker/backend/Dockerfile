FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g pnpm@10.33.0

WORKDIR /app

# ==========================================
# DEPENDENCIAS
# ==========================================
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json

COPY backend/prisma ./backend/prisma
COPY backend/prisma7.config.ts ./backend/prisma7.config.ts

RUN pnpm install --frozen-lockfile

# ==========================================
# BUILD
# ==========================================
FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend ./frontend
COPY backend ./backend

RUN pnpm --filter backend exec prisma generate
RUN pnpm --filter backend build

# ==========================================
# PRODUCCIÓN
# ==========================================
FROM node:24-bookworm-slim AS runner

WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=3001

# Instalar PostgreSQL Client 17 desde el repositorio oficial PGDG.
# Se instala únicamente el cliente, no un servidor PostgreSQL.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL \
        https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    && printf "Types: deb\nURIs: https://apt.postgresql.org/pub/repos/apt\nSuites: bookworm-pgdg\nArchitectures: %s\nComponents: main\nSigned-By: /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc\n" \
        "$(dpkg --print-architecture)" \
        > /etc/apt/sources.list.d/pgdg.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-17 \
    && pg_dump --version \
    && pg_restore --version \
    && apt-get purge -y --auto-remove curl \
    && rm -rf /var/lib/apt/lists/*

# Archivos compilados
COPY --from=builder /app/backend/dist ./dist

# Dependencias
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/backend/node_modules ./node_modules

# Configuración y Prisma
COPY --from=builder /app/backend/package.json ./package.json
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/backend/prisma7.config.ts ./prisma7.config.ts

EXPOSE 3001

CMD ["node", "dist/main.js"]
