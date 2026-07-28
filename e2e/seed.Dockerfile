# Imagem dedicada só pro seed do E2E — reaproveita o setup do catalog-sync
# (Prisma já configurado a partir do schema real), mas com o script COPIADO
# em vez de bind-montado: um bind mount pra dentro de docker-compose.e2e.yml
# funciona em CI só não em toda máquina de dev (drives de rede/NAS quebram
# bind mount no Docker Desktop — ver memory/local_dev_environment.md).
FROM node:20-alpine

WORKDIR /service

RUN apk add --no-cache openssl

COPY app/prisma ./prisma
COPY catalog-sync/package.json ./package.json
RUN npm install
RUN npx prisma generate

COPY e2e/seed.mjs ./seed.mjs

ENTRYPOINT ["node", "seed.mjs"]
