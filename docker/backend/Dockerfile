FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g pnpm@10.33.0

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json

# Archivos necesarios para que el postinstall de Prisma funcione
COPY backend/prisma ./backend/prisma
COPY backend/prisma7.config.ts ./backend/prisma7.config.ts

RUN pnpm install --frozen-lockfile

FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend ./frontend
COPY backend ./backend

RUN pnpm --filter backend build

FROM node:24-bookworm-slim AS runner

WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/package.json ./package.json
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/backend/prisma7.config.ts ./prisma7.config.ts

EXPOSE 3001

CMD ["node", "dist/main.js"]