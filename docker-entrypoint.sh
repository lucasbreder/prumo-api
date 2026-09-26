#!/bin/sh
set -e

echo "==> Aplicando migrations do Prisma..."
./node_modules/.bin/prisma migrate deploy

echo "==> Iniciando aplicação..."
exec node dist/main.js
