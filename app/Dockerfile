FROM node:20-alpine AS deps
WORKDIR /app
COPY app/package.json ./
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
# Prisma precisa do OpenSSL pra rodar seus engines nativos no Alpine (musl)
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY app/prisma ./prisma
COPY app/ .
# Valor fictício: só existe durante o build, nunca é usado de verdade
# (evita qualquer tentativa de conexão real durante `prisma generate`/`next build`)
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
# Prisma Client roda em tempo de execução aqui e também precisa do OpenSSL
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["npm", "run", "start"]
