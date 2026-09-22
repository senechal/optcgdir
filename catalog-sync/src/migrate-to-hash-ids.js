// Migração única: troca a chave primária de `cards` de card_image_id (bruto
// da API, reaproveitado entre variantes diferentes) pra um hash estável de
// vários atributos (ver cardHash.js). Rodar UMA VEZ depois do deploy da
// versão que traz esse arquivo, antes/depois do próximo full sync (tanto
// faz a ordem — o sync já upserta pelo id novo).
//
// Uso:
//   node src/migrate-to-hash-ids.js
//
// Idempotente: se a coluna `cards.id` já existir, não faz nada. Roda tudo
// dentro de uma transação — se qualquer passo falhar, nada é aplicado.
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { computeCardId } from "./cardHash.js";

const prisma = new PrismaClient();

async function alreadyMigrated() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cards' AND column_name = 'id'
  `);
  return rows.length > 0;
}

// Cartas que já passaram pela desambiguação por sufixo do PR #46/#47 têm
// "<card_image_id original>__<slug>" em vez do valor bruto da API — sem
// desfazer isso aqui, o hash calculado agora nunca bateria com o que a
// próxima sync (que sempre usa o card_image_id bruto de verdade) vai
// calcular pra essa mesma carta, criando uma linha duplicada em vez de
// atualizar a existente.
export function rawCardImageId(storedCardImageId) {
  return storedCardImageId.split("__")[0];
}

async function main() {
  if (await alreadyMigrated()) {
    console.log("[migrate] já aplicada (cards.id já existe) — nada a fazer.");
    return;
  }

  console.log("[migrate] iniciando migração pra id hash...");

  const cards = await prisma.$queryRawUnsafe(`
    SELECT card_image_id, card_name, set_id, card_set_id, remote_image_url
    FROM cards
  `);
  console.log(`[migrate] ${cards.length} carta(s) encontrada(s)`);

  const idByCardImageId = new Map();
  for (const c of cards) {
    const hash = computeCardId({
      cardName: c.card_name,
      setId: c.set_id,
      cardSetId: c.card_set_id,
      cardImageId: rawCardImageId(c.card_image_id),
      cardImage: c.remote_image_url,
    });
    idByCardImageId.set(c.card_image_id, hash);
  }

  // Confere que não há duas cartas diferentes colidindo no mesmo hash ANTES
  // de tocar no banco — abortar aqui é seguro, abortar no meio das ALTER
  // TABLE não.
  const seenBy = new Map();
  for (const [cardImageId, hash] of idByCardImageId) {
    if (seenBy.has(hash)) {
      throw new Error(
        `[migrate] hash colidindo entre "${seenBy.get(hash)}" e "${cardImageId}" (${hash}) — abortando antes de alterar o esquema.`
      );
    }
    seenBy.set(hash, cardImageId);
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`ALTER TABLE cards ADD COLUMN id TEXT`);
      for (const [cardImageId, hash] of idByCardImageId) {
        await tx.$executeRawUnsafe(`UPDATE cards SET id = $1 WHERE card_image_id = $2`, hash, cardImageId);
      }
      await tx.$executeRawUnsafe(`ALTER TABLE cards ALTER COLUMN id SET NOT NULL`);
      await tx.$executeRawUnsafe(`ALTER TABLE cards ADD CONSTRAINT cards_id_key UNIQUE (id)`);

      await tx.$executeRawUnsafe(`ALTER TABLE collection_items ADD COLUMN card_id TEXT`);
      await tx.$executeRawUnsafe(`ALTER TABLE deck_cards ADD COLUMN card_id TEXT`);
      await tx.$executeRawUnsafe(`ALTER TABLE decks ADD COLUMN leader_card_id_new TEXT`);

      await tx.$executeRawUnsafe(`
        UPDATE collection_items ci SET card_id = c.id
        FROM cards c WHERE ci.card_image_id = c.card_image_id
      `);
      await tx.$executeRawUnsafe(`
        UPDATE deck_cards dc SET card_id = c.id
        FROM cards c WHERE dc.card_image_id = c.card_image_id
      `);
      await tx.$executeRawUnsafe(`
        UPDATE decks d SET leader_card_id_new = c.id
        FROM cards c WHERE d.leader_card_id = c.card_image_id
      `);

      await tx.$executeRawUnsafe(`ALTER TABLE collection_items ALTER COLUMN card_id SET NOT NULL`);
      await tx.$executeRawUnsafe(`ALTER TABLE deck_cards ALTER COLUMN card_id SET NOT NULL`);

      await tx.$executeRawUnsafe(`ALTER TABLE collection_items DROP CONSTRAINT collection_items_card_image_id_fkey`);
      await tx.$executeRawUnsafe(`ALTER TABLE deck_cards DROP CONSTRAINT deck_cards_card_image_id_fkey`);
      await tx.$executeRawUnsafe(`ALTER TABLE decks DROP CONSTRAINT decks_leader_card_id_fkey`);

      // Esses dois existem como índice único puro (não constraint nomeada) —
      // é assim que `prisma db push` materializa @@unique, ao contrário das
      // FKs acima, que viram constraint de verdade. Confirmado ao vivo via
      // pg_indexes antes de escrever isso (ALTER TABLE ... DROP CONSTRAINT
      // falha com "constraint does not exist" pra esses dois).
      await tx.$executeRawUnsafe(`DROP INDEX collection_items_card_image_id_user_id_condition_key`);
      await tx.$executeRawUnsafe(`DROP INDEX deck_cards_deck_id_card_image_id_key`);

      await tx.$executeRawUnsafe(`ALTER TABLE cards DROP CONSTRAINT cards_pkey`);
      await tx.$executeRawUnsafe(`ALTER TABLE cards ADD PRIMARY KEY (id)`);
      await tx.$executeRawUnsafe(`ALTER TABLE cards DROP CONSTRAINT cards_id_key`); // a PK já garante unicidade

      await tx.$executeRawUnsafe(`ALTER TABLE collection_items DROP COLUMN card_image_id`);
      await tx.$executeRawUnsafe(`ALTER TABLE deck_cards DROP COLUMN card_image_id`);
      await tx.$executeRawUnsafe(`ALTER TABLE decks DROP COLUMN leader_card_id`);
      await tx.$executeRawUnsafe(`ALTER TABLE decks RENAME COLUMN leader_card_id_new TO leader_card_id`);

      await tx.$executeRawUnsafe(
        `ALTER TABLE collection_items ADD CONSTRAINT collection_items_card_id_user_id_condition_key UNIQUE (card_id, user_id, condition)`
      );
      await tx.$executeRawUnsafe(
        `ALTER TABLE deck_cards ADD CONSTRAINT deck_cards_deck_id_card_id_key UNIQUE (deck_id, card_id)`
      );

      await tx.$executeRawUnsafe(
        `ALTER TABLE collection_items ADD CONSTRAINT collection_items_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id)`
      );
      await tx.$executeRawUnsafe(
        `ALTER TABLE deck_cards ADD CONSTRAINT deck_cards_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id)`
      );
      await tx.$executeRawUnsafe(
        `ALTER TABLE decks ADD CONSTRAINT decks_leader_card_id_fkey FOREIGN KEY (leader_card_id) REFERENCES cards(id)`
      );
    },
    { timeout: 10 * 60 * 1000 }
  );

  console.log("[migrate] concluído — cards.id (hash) é a chave primária agora.");
}

// Só roda de verdade quando o arquivo é executado direto (`node
// src/migrate-to-hash-ids.js`) — importar pra testar rawCardImageId() não
// pode disparar a migração como efeito colateral. pathToFileURL (em vez de
// só prefixar "file://") normaliza separadores de path — no Windows,
// process.argv[1] vem com barras invertidas e um `file://${...}` nunca
// bateria com import.meta.url, fazendo essa checagem falhar sempre.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((err) => {
      console.error("[migrate] erro fatal (nada foi alterado — a transação não foi commitada):", err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
