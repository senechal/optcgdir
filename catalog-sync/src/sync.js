// Sincroniza catálogo local (Postgres + imagens em volume) com a optcgapi.com.
// Roda como job separado (nunca em runtime da app). Ver docker-compose.yml.
//
// Uso:
//   FULL_SYNC=true node src/sync.js   -> baixa tudo (seed inicial)
//   node src/sync.js                 -> incremental, usa endpoints /twoweeks/
//
// A API não tem auth nem rate limit formal, mas é hospedada numa VPS pessoal
// do mantenedor -- por isso: 1 sync por execução, pequeno atraso entre
// downloads de imagem, e nunca chamado a partir do app em runtime.

import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const BASE_URL = process.env.OPTCGAPI_BASE_URL || "https://optcgapi.com/api";
const IMAGES_PATH = process.env.CATALOG_IMAGES_PATH || "/data/catalog-images";
const FULL_SYNC = process.env.FULL_SYNC === "true";
const IMAGE_DOWNLOAD_DELAY_MS = 150; // não martelar o servidor deles

const SOURCES = FULL_SYNC
  ? [
      { url: `${BASE_URL}/allSetCards/`, sourceType: "set" },
      { url: `${BASE_URL}/allSTCards/`, sourceType: "starter" },
      { url: `${BASE_URL}/allPromoCards/`, sourceType: "promo" },
      { url: `${BASE_URL}/allDonCards/`, sourceType: "don" },
    ]
  : [
      // Sync incremental: só cartas atualizadas nas últimas 2 semanas
      { url: `${BASE_URL}/sets/card/twoweeks/`, sourceType: "set" },
      { url: `${BASE_URL}/decks/card/twoweeks/`, sourceType: "starter" },
      { url: `${BASE_URL}/promos/card/twoweeks/`, sourceType: "promo" },
    ];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Falha ao buscar ${url}: HTTP ${res.status}`);
  }
  return res.json();
}

async function syncSets() {
  const sets = await fetchJson(`${BASE_URL}/allSets/`);
  let count = 0;
  for (const s of sets) {
    // A API usa "set_id"/"set_name" nesse endpoint
    if (!s.set_id) continue;
    await prisma.set.upsert({
      where: { id: s.set_id },
      update: { name: s.set_name },
      create: { id: s.set_id, name: s.set_name },
    });
    count++;
  }
  console.log(`[sync] sets: ${count} sincronizados`);
}

async function ensureSetExists(setId, fallbackName) {
  if (!setId) return;
  const exists = await prisma.set.findUnique({ where: { id: setId } });
  if (!exists) {
    // Alguns endpoints (promo/don) podem não ter set formal -> cria um placeholder
    await prisma.set.upsert({
      where: { id: setId },
      update: {},
      create: { id: setId, name: fallbackName || setId },
    });
  }
}

async function downloadImage(remoteUrl, cardImageId) {
  if (!remoteUrl) return null;
  const ext = path.extname(new URL(remoteUrl).pathname) || ".jpg";
  const filename = `${cardImageId}${ext}`;
  const localPath = path.join(IMAGES_PATH, filename);

  try {
    await fs.access(localPath);
    return filename; // já baixada, não repete
  } catch {
    // não existe ainda, segue pro download
  }

  const res = await fetch(remoteUrl);
  if (!res.ok) {
    console.warn(`[sync] falha ao baixar imagem ${remoteUrl}: HTTP ${res.status}`);
    return null;
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(IMAGES_PATH, { recursive: true });
  await fs.writeFile(localPath, buffer);
  await new Promise((r) => setTimeout(r, IMAGE_DOWNLOAD_DELAY_MS));
  return filename;
}

async function upsertCard(raw, sourceType) {
  if (!raw.card_image_id) {
    console.warn("[sync] carta sem card_image_id, ignorando:", raw.card_name);
    return;
  }

  await ensureSetExists(raw.set_id, raw.set_name);

  const localImagePath = await downloadImage(raw.card_image, raw.card_image_id);

  await prisma.card.upsert({
    where: { cardImageId: raw.card_image_id },
    update: {
      cardSetId: raw.card_set_id ?? raw.card_image_id,
      cardName: raw.card_name,
      cardText: raw.card_text ?? null,
      cardColor: raw.card_color ?? null,
      cardType: raw.card_type ?? "Unknown",
      rarity: raw.rarity ?? null,
      cardCost: raw.card_cost != null ? String(raw.card_cost) : null,
      cardPower: raw.card_power != null ? String(raw.card_power) : null,
      life: raw.life != null ? String(raw.life) : null,
      counterAmount: raw.counter_amount != null ? String(raw.counter_amount) : null,
      attribute: raw.attribute ?? null,
      subTypes: raw.sub_types ?? null,
      isParallel: raw.card_image_id.includes("_p"),
      setId: raw.set_id,
      sourceType,
      remoteImageUrl: raw.card_image ?? null,
      localImagePath,
      lastSyncedAt: new Date(),
    },
    create: {
      cardImageId: raw.card_image_id,
      cardSetId: raw.card_set_id ?? raw.card_image_id,
      cardName: raw.card_name,
      cardText: raw.card_text ?? null,
      cardColor: raw.card_color ?? null,
      cardType: raw.card_type ?? "Unknown",
      rarity: raw.rarity ?? null,
      cardCost: raw.card_cost != null ? String(raw.card_cost) : null,
      cardPower: raw.card_power != null ? String(raw.card_power) : null,
      life: raw.life != null ? String(raw.life) : null,
      counterAmount: raw.counter_amount != null ? String(raw.counter_amount) : null,
      attribute: raw.attribute ?? null,
      subTypes: raw.sub_types ?? null,
      isParallel: raw.card_image_id.includes("_p"),
      setId: raw.set_id,
      sourceType,
      remoteImageUrl: raw.card_image ?? null,
      localImagePath,
    },
  });
}

async function main() {
  const startedAt = Date.now();
  console.log(`[sync] iniciando ${FULL_SYNC ? "sync completo" : "sync incremental"}...`);

  await syncSets();

  let total = 0;
  for (const source of SOURCES) {
    try {
      const cards = await fetchJson(source.url);
      console.log(`[sync] ${source.url} -> ${cards.length} cartas`);
      for (const raw of cards) {
        await upsertCard(raw, source.sourceType);
        total++;
      }
    } catch (err) {
      // Uma fonte falhar não deve derrubar o sync inteiro
      console.error(`[sync] erro em ${source.url}:`, err.message);
    }
  }

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[sync] concluído: ${total} cartas processadas em ${seconds}s`);
}

main()
  .catch((err) => {
    console.error("[sync] erro fatal:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
