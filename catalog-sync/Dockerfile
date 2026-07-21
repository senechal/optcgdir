FROM node:20-alpine

WORKDIR /service

# Schema compartilhado com o app (mesma fonte de verdade do banco)
COPY app/prisma ./prisma
COPY catalog-sync/package.json ./package.json
RUN npm install
RUN npx prisma generate

COPY catalog-sync/src ./src

# Sem CMD fixo: docker-compose define via `command`/profile
# - `catalog-sync`            -> roda uma vez e sai (seed / sync manual)
# - `catalog-sync-scheduler`  -> fica de pé, roda no cron interno
ENTRYPOINT ["node"]
CMD ["src/sync.js"]
