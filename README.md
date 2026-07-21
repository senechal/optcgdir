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

O `docker-compose.yml` builda as imagens direto da URL do repositório Git
(`https://github.com/senechal/optcgdir.git#main`) — o próprio Docker clona o
código na hora do build. Isso significa que **não precisa clonar nada
manualmente**: é só colar o conteúdo do `docker-compose.yml` na interface do
ZimaOS (ou salvar o arquivo em qualquer pasta e rodar `docker compose up`
dali) que tudo é buscado e construído sozinho.

Também não depende de um arquivo `.env`: as variáveis sensíveis
(`POSTGRES_PASSWORD`, `NEXTAUTH_SECRET`) não têm valor padrão, então o
Compose recusa subir sem elas e mostra uma mensagem de erro clara indicando
qual falta — é exatamente isso que faz a UI do ZimaOS detectar essas
variáveis e te pedir pra preenchê-las antes do deploy.

### Opção 1 — pela interface do ZimaOS (recomendado)

1. Copie o conteúdo de `docker-compose.yml` (deste repo, ou direto do link
   raw do GitHub) e cole na tela de criar uma nova stack/app do ZimaOS.
2. A UI vai detectar as variáveis (`POSTGRES_PASSWORD`, `NEXTAUTH_SECRET`,
   `NEXTAUTH_URL`, `APP_PORT`, etc.) e mostrar campos pra preenchê-las antes
   do deploy.
3. Dê o deploy. O serviço `init` roda sozinho antes do `app` subir: aplica o
   schema no banco e, se o catálogo estiver vazio, baixa todas as cartas +
   imagens automaticamente (isso leva alguns minutos na primeira vez — o
   `app` só sobe depois que o `init` terminar). Não precisa rodar nada manual.

### Opção 2 — CLI (rodando fora da UI do ZimaOS)

```bash
mkdir optcg-collection && cd optcg-collection
curl -O https://raw.githubusercontent.com/senechal/optcgdir/main/docker-compose.yml

export POSTGRES_PASSWORD="troque-esta-senha"
export NEXTAUTH_SECRET="$(openssl rand -base64 32)"
export NEXTAUTH_URL="http://<ip-do-zimaos>:3000"

docker compose up -d
```

Pronto — `init` cuida do schema e do seed inicial sozinho, e `app` sobe
assim que ele terminar.

### Atualizando depois de mudanças no repo

Como o build sempre busca o `main` do GitHub, basta forçar rebuild sem cache:
```bash
docker compose build --no-cache app catalog-sync
docker compose up -d
```

Acesse em `http://<ip-do-zimaos>:3000` (porta configurável via `APP_PORT`).

> **Nota:** builds via contexto Git exigem BuildKit (padrão em versões
> recentes do Docker Engine) e acesso à internet no momento do build — depois
> de construídas, as imagens rodam normalmente offline.

## Serviços

| Serviço | Papel | Sempre ligado? |
|---|---|---|
| `db` | Postgres 16 | Sim |
| `init` | Aplica schema + seed inicial (só se catálogo vazio) | Não — roda e sai |
| `app` | Next.js (dashboard, auth, API) — só sobe depois do `init` terminar | Sim |
| `catalog-sync` | Sync manual sob demanda (força um sync fora do agendamento) | Não — roda e sai |
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

| Variável | Obrigatória? | Default | Descrição |
|---|---|---|---|
| `POSTGRES_USER` | Não | `optcg` | Usuário do Postgres |
| `POSTGRES_PASSWORD` | **Sim** | — | Senha do Postgres |
| `POSTGRES_DB` | Não | `optcg_collection` | Nome do banco |
| `POSTGRES_PORT` | Não | `5432` | Porta exposta do Postgres |
| `APP_PORT` | Não | `3000` | Porta exposta do dashboard |
| `NEXTAUTH_SECRET` | **Sim** | — | Segredo da sessão (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Não | `http://localhost:3000` | URL pública da app na sua rede local |

## Comandos úteis

```bash
# forçar um sync manual agora (fora do agendamento semanal):
docker compose run --rm catalog-sync

# ver logs do agendador de sync:
docker compose logs -f catalog-sync-scheduler

# aplicar mudanças de schema depois de editar prisma/schema.prisma
# (o serviço `init` já faz isso sozinho no próximo `docker compose up`,
# mas dá pra forçar na hora sem esperar):
docker compose run --rm init npx prisma db push --skip-generate

# rodar o seed inicial de novo mesmo com o catálogo já populado
# (ex: se quiser re-baixar todas as imagens):
docker compose run --rm -e FULL_SYNC=true catalog-sync
```

## Créditos e licenciamento de dados

Dados de cartas via [optcgapi.com](https://optcgapi.com) (API pública,
mantida por DomoSlime). One Piece e o One Piece Card Game são marcas de
Eiichiro Oda, Bandai, Shonen Jump e Viz Media — este projeto é um uso pessoal
e não-comercial de fã.
