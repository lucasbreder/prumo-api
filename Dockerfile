# ---- deps: instala tudo (dev incluído) ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts + --include=dev: o Coolify injeta NODE_ENV=production em
# todos os stages; sem --include=dev o npm pularia devDeps (CLI do prisma).
RUN npm ci --ignore-scripts --include=dev

# ---- build: gera o client e compila o Nest ----
# generate acontece AQUI (e não no deps) porque o gerador do Prisma 7 decide a
# extensão dos imports (./x.js vs ./x.ts) lendo o tsconfig.json mais próximo;
# sem ele em runtime o node quebra com ERR_MODULE_NOT_FOUND em dist/*.ts.
FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
RUN DATABASE_URL="postgresql://build:***@localhost:5432/build" ./node_modules/.bin/prisma generate \
  && npm run build

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
