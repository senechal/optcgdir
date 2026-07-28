// Seed mínimo e determinístico pra rodar os testes E2E offline, sem
// depender da API externa (optcgapi.com) que o `catalog-sync` real usa —
// isso deixaria o CI lento e frágil (minutos de download + dependência de
// serviço de terceiro). Roda via `docker compose run --rm init` na stack
// de E2E (ver docker-compose.e2e.yml), reaproveitando a imagem do
// catalog-sync (já tem o Prisma Client gerado a partir do schema real).
import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";

const SET = { id: "OP-01", name: "Romance Dawn" };

// "Monkey.D.Luffy" bate com uma foto real usada nos testes de scan
// (op12-015.jpg) — o serviço de OCR não lê o código impresso de forma
// confiável (ver memory/ocr_code_recognition_limitation.md), mas o nome
// geralmente sai legível o bastante pro fallback por nome funcionar.
const CARDS = [
  {
    cardImageId: "OP01-001",
    cardSetId: "OP01-001",
    cardName: "Monkey.D.Luffy",
    cardText: "On Play Give up to 1 of your Leader or Character cards +1000 power.",
    cardColor: "Red",
    cardType: "Leader",
    rarity: "L",
    cardCost: null,
    cardPower: "5000",
    counterAmount: null,
    setId: SET.id,
    sourceType: "starter",
  },
  {
    cardImageId: "OP01-002",
    cardSetId: "OP01-002",
    cardName: "Roronoa Zoro",
    cardText: "Rush",
    cardColor: "Red",
    cardType: "Character",
    rarity: "SR",
    cardCost: "3",
    cardPower: "5000",
    counterAmount: "1000",
    setId: SET.id,
    sourceType: "booster",
  },
  {
    cardImageId: "OP01-003",
    cardSetId: "OP01-003",
    cardName: "Nami",
    cardText: null,
    cardColor: "Blue",
    cardType: "Character",
    rarity: "R",
    cardCost: "2",
    cardPower: "2000",
    counterAmount: "2000",
    setId: SET.id,
    sourceType: "booster",
  },
];

async function main() {
  spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], { stdio: "inherit" });

  const prisma = new PrismaClient();
  try {
    await prisma.set.upsert({ where: { id: SET.id }, update: {}, create: SET });
    for (const card of CARDS) {
      await prisma.card.upsert({ where: { cardImageId: card.cardImageId }, update: card, create: card });
    }
    console.log(`[e2e-seed] seeded ${CARDS.length} cards in set ${SET.id}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[e2e-seed] failed:", err);
  process.exit(1);
});
