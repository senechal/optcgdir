# OPTCG Collection Manager

Gerenciador pessoal de coleção do One Piece Card Game, self-hosted, sem
dependências de serviços cloud pagos.

## Status atual

Esta é a **infraestrutura base** (etapa a): Docker Compose, Postgres, schema
Prisma e o job de sync do catálogo (optcgapi.com). O dashboard com
filtros/busca/grid (etapa b), o fluxo de reconhecimento por câmera (etapa c)
e o CRUD de decks (etapa d) serão adicionados nas próximas etapas.

## Requisitos

- Docker + Docker Compose (v2, plugin `docker compose`), funcionando no ZimaOS.
- Acesso à internet apenas durante o sync do catálogo (a app em si funciona
  100% offline depois de sincronizada).

## Instalação

```bash
cp .env.example .env
# edite o .env: troque POSTGRES_PASSWORD, NEXTAUTH_SECRET, e ajuste
# NEXTAUTH_URL para o IP/hostname do seu ZimaOS na rede local.

docker compose up -d db
# espera o banco subir, depois roda as migrations:
docker compose run --rm app npx prisma migrate deploy

# seed inicial do catálogo (baixa TODAS as cartas + imagens — demora alguns
# minutos na primeira vez):
docker compose run --rm -e FULL_SYNC=true catalog-sync

# sobe o app e o agendador de sync semanal:
docker compose up -d app catalog-sync-scheduler
```

Acesse em `http://<ip-do-zimaos>:3000` (porta configurável via `APP_PORT`).

## Serviços

| Serviço | Papel | Sempre ligado? |
|---|---|---|
| `db` | Postgres 16 | Sim |
| `app` | Next.js (dashboard, auth, API) | Sim |
| `catalog-sync` | Sync sob demanda (seed inicial / manual) | Não — roda e sai |
| `catalog-sync-scheduler` | Sync incremental automático (semanal) | Sim |

## Volumes (dados persistentes — inclua no seu backup manual)

| Volume | Conteúdo | Backup |
|---|---|---|
| `optcg-db-data` | Postgres (coleção, decks, usuários) | `docker compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql`, ou backup do volume inteiro |
| `optcg-catalog-images` | Imagens oficiais do catálogo (baixadas 1x, re-geráveis via sync) | Opcional — pode ser recriado rodando o sync novamente |

Fotos tiradas pelo usuário via câmera (etapa c) **não** entram em nenhum
volume nomeado/persistente — ficam numa pasta temporária com rotina de
limpeza automática, detalhado quando essa etapa for implementada.

## Variáveis de ambiente

Veja `.env.example`. Resumo:

- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`: credenciais do Postgres.
- `APP_PORT`: porta exposta do dashboard (padrão 3000).
- `NEXTAUTH_SECRET`: segredo da sessão (gere com `openssl rand -base64 32`).
- `NEXTAUTH_URL`: URL pública da app na sua rede local.

## Comandos úteis

```bash
# rodar sync manual (incremental, só cartas das últimas 2 semanas):
docker compose run --rm catalog-sync

# ver logs do agendador de sync:
docker compose logs -f catalog-sync-scheduler

# aplicar mudanças de schema depois de editar prisma/schema.prisma:
docker compose run --rm app npx prisma migrate dev --name nome_da_mudanca
```

## Créditos e licenciamento de dados

Dados de cartas via [optcgapi.com](https://optcgapi.com) (API pública,
mantida por DomoSlime). One Piece e o One Piece Card Game são marcas de
Eiichiro Oda, Bandai, Shonen Jump e Viz Media — este projeto é um uso pessoal
e não-comercial de fã.
