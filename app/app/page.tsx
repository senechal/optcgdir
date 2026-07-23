import { prisma } from "../lib/prisma";
import { getDefaultUserId } from "../lib/currentUser";
import Dashboard, { type CardWithCollectionInfo } from "../components/Dashboard";

// Consulta o banco em tempo real — não pode ser pré-renderizada no build
// (não há Postgres disponível durante a construção da imagem).
export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const userId = await getDefaultUserId();

  const color = first(searchParams.color);
  const rarity = first(searchParams.rarity);
  const type = first(searchParams.type);
  const setId = first(searchParams.set);
  const search = first(searchParams.search)?.trim();
  const onlyWithCounter = first(searchParams.counter) === "1";
  const onlyInDeck = first(searchParams.inDeck) === "1";
  const onlyDuplicates = first(searchParams.duplicates) === "1";
  const onlyWantsTrade = first(searchParams.wantsTrade) === "1";
  const onlyOwned = first(searchParams.owned) === "1";
  const costMin = first(searchParams.costMin);
  const costMax = first(searchParams.costMax);
  const powerMin = first(searchParams.powerMin);
  const powerMax = first(searchParams.powerMax);
  const sort = first(searchParams.sort) || "name";
  const view = (first(searchParams.view) as "grid" | "list") || "grid";
  const groupBySet = first(searchParams.groupBySet) === "1";

  // Filtros que dá pra empurrar direto pro Postgres
  const where: Record<string, unknown> = {};
  if (color) where.cardColor = { contains: color, mode: "insensitive" };
  if (rarity) where.rarity = rarity;
  if (type) where.cardType = type;
  if (setId) where.setId = setId;
  if (onlyWithCounter) where.counterAmount = { not: null };
  if (search) {
    where.OR = [
      { cardName: { contains: search, mode: "insensitive" } },
      { cardImageId: { contains: search, mode: "insensitive" } },
      { cardSetId: { contains: search, mode: "insensitive" } },
      { cardText: { contains: search, mode: "insensitive" } },
    ];
  }

  const [rawCards, sets, colorRows, rarityRows, typeRows] = await Promise.all([
    prisma.card.findMany({
      where,
      include: {
        collectionItems: { where: { userId } },
        deckCards: { where: { deck: { userId } } },
      },
    }),
    prisma.set.findMany({ orderBy: { id: "asc" } }),
    prisma.card.findMany({ distinct: ["cardColor"], select: { cardColor: true } }),
    prisma.card.findMany({ distinct: ["rarity"], select: { rarity: true } }),
    prisma.card.findMany({ distinct: ["cardType"], select: { cardType: true } }),
  ]);

  // Achata pra um formato simples e calcula quantidade/alocação/quero-trocar
  let cards: CardWithCollectionInfo[] = rawCards.map((c: any) => ({
    cardImageId: c.cardImageId,
    cardSetId: c.cardSetId,
    cardName: c.cardName,
    cardColor: c.cardColor,
    cardType: c.cardType,
    rarity: c.rarity,
    cardCost: c.cardCost,
    cardPower: c.cardPower,
    counterAmount: c.counterAmount,
    setId: c.setId,
    localImagePath: c.localImagePath,
    quantity: c.collectionItems.reduce((sum: number, ci: any) => sum + ci.quantity, 0),
    wantsTrade: c.collectionItems.some((ci: any) => ci.wantsTrade),
    allocatedInDecks: c.deckCards.reduce((sum: number, dc: any) => sum + dc.quantity, 0),
  }));

  // Filtros numéricos / derivados: mais simples de aplicar em memória
  // (catálogo tem só alguns milhares de cartas, sem problema de performance).
  if (onlyOwned) cards = cards.filter((c) => c.quantity > 0);
  if (onlyDuplicates) cards = cards.filter((c) => c.quantity > 1);
  if (onlyWantsTrade) cards = cards.filter((c) => c.wantsTrade);
  if (onlyInDeck) cards = cards.filter((c) => c.allocatedInDecks > 0);
  if (costMin) cards = cards.filter((c) => c.cardCost !== null && Number(c.cardCost) >= Number(costMin));
  if (costMax) cards = cards.filter((c) => c.cardCost !== null && Number(c.cardCost) <= Number(costMax));
  if (powerMin) cards = cards.filter((c) => c.cardPower !== null && Number(c.cardPower) >= Number(powerMin));
  if (powerMax) cards = cards.filter((c) => c.cardPower !== null && Number(c.cardPower) <= Number(powerMax));

  const sorters: Record<string, (a: CardWithCollectionInfo, b: CardWithCollectionInfo) => number> = {
    name: (a, b) => a.cardName.localeCompare(b.cardName),
    cost: (a, b) => (Number(a.cardCost) || 0) - (Number(b.cardCost) || 0),
    power: (a, b) => (Number(a.cardPower) || 0) - (Number(b.cardPower) || 0),
    rarity: (a, b) => (a.rarity || "").localeCompare(b.rarity || ""),
    set: (a, b) => a.setId.localeCompare(b.setId),
    dateAdded: (a, b) => a.cardImageId.localeCompare(b.cardImageId), // fallback estável
  };
  cards.sort(sorters[sort] || sorters.name);

  const filterOptions = {
    sets: sets.map((s: any) => ({ id: s.id, name: s.name })),
    colors: colorRows.map((c: any) => c.cardColor).filter((v: string | null): v is string => Boolean(v)),
    rarities: rarityRows.map((r: any) => r.rarity).filter((v: string | null): v is string => Boolean(v)),
    types: typeRows.map((t: any) => t.cardType).filter((v: string | null): v is string => Boolean(v)),
  };

  const currentParamsRecord: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    const v = first(value);
    if (v) currentParamsRecord[key] = v;
  }

  return (
    <Dashboard
      cards={cards}
      filterOptions={filterOptions}
      currentParams={currentParamsRecord}
      view={view}
      groupBySet={groupBySet}
    />
  );
}
