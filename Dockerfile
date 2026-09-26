# ---- deps: instala tudo (dev incluído) e roda prisma generate via postinstall ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
# --ignore-scripts: pula o postinstall; generate roda explícito com URL dummy
# (generate não conecta no banco; em runtime o migrate deploy usa o DATABASE_URL real)
RUN npm ci --ignore-scripts \
  && DATABASE_URL="postgresql://build:***@localhost:5432/build" npx prisma generate

# ---- build: compila o Nest ----
FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- runner: só produção + CLI do prisma para rodar as migrations ----
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# --ignore-scripts: evita o postinstall (prisma generate) que precisaria do CLI dev
# CLI do prisma (devDep) instalado temporariamente só para o `migrate deploy`
# do entrypoint. NODE_ENV=development é necessário senão o npm descarta o
# pacote com --no-save num tree production.
RUN npm ci --omit=dev --ignore-scripts \
  && NODE_ENV=development npm install --no-save --ignore-scripts --no-audit --no-fund prisma@7.10.0

COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 7001
ENTRYPOINT ["./docker-entrypoint.sh"]
