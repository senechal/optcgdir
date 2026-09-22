import type { CardWithCollectionInfo } from "./dashboardTypes";

// O card_name da optcgapi já vem com sufixos como "(Parallel)" ou
// "(Alternative Art)" — removemos porque a variante já é representada
// separadamente (V.1/V.2/Promo no link do Cardmarket, ou porque buscar
// pelo nome-base traz todas as variantes daquela carta).
export function stripVariantSuffix(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "");
}

export function cardmarketUrl(card: CardWithCollectionInfo): string {
  const baseName = stripVariantSuffix(card.cardName);
  const variant = card.sourceType === "promo" ? "Promo" : card.isParallel ? "V.2" : "V.1";
  const searchString = `${baseName} ${card.cardSetId} ${variant}`;
  return `https://www.cardmarket.com/en/OnePiece/Products/Search?searchString=${encodeURIComponent(
    searchString
  )}`;
}

// "Alt art" não é um campo próprio no catálogo — é uma variante marcada no
// próprio card_name (ex: "Kouzuki Oden (Alternate Art)", "Jack (Parallel)",
// "Kouzuki Oden (SPR)", "Kid & Killer (SP)", "Borsalino (Manga)", "Kingdew
// (Pandaman Art)"). Neste sistema contam como alt art todas as versões
// alternativas de uma carta que repetem o código dela: Parallel/SPR/SP/
// Manga/Pandaman/TR, Full Art, os foils (Pirate/Jolly Roger/Textured), Box
// Topper, Dash Pack, Wanted Poster e Reprint. Ficam de fora sufixos que são
// parte do nome do personagem (ex: "Zephyr (Navy)", "Mr.3 (Galdino)").
// "Alternate Art" fica sem parênteses de propósito pra também pegar
// "(Super Alternate Art)", "(Red Super Alternate Art)" e "(Super Leader
// Alternate Art)". Os demais incluem os parênteses: "SP" sozinho bateria em
// substrings de nomes normais tipo "Spandam" ou "Speed" — o marcador de
// verdade é sempre "(SP)" isolado. Lista compartilhada com o filtro
// "Ocultar alt arts" (app/app/page.tsx) pra não duplicar os textos.
export const ALT_ART_MARKERS = [
  "Alternate Art",
  "(Pandaman Art)",
  "(Parallel)",
  "(SPR)",
  "(SP)",
  "(TR)",
  "(Manga)",
  "(Full Art)",
  "(Pirate Foil)",
  "(Jolly Roger Foil)",
  "(Textured Foil)",
  "(Box Topper)",
  "(Dash Pack)",
  "(Wanted Poster)",
  "(Reprint)",
];

export function isAltArt(cardName: string): boolean {
  const lowerName = cardName.toLowerCase();
  return ALT_ART_MARKERS.some((marker) => lowerName.includes(marker.toLowerCase()));
}

export function isSP(cardName: string): boolean {
  return cardName.toLowerCase().includes("(sp)");
}

// Regras de posicionamento pro sort padrão (código) e pra aba "Por Set":
// 1. Dentro do mesmo código impresso, a versão comum vem antes da alt art
//    (o sort por código já agrupa uma carta com suas variantes; isso só
//    decide a ordem entre elas).
// 2. Dentro do mesmo set, cartas SP sempre ficam por último — depois de
//    todas as outras cartas daquele set, alt art incluída.
export function compareCardsForDisplay(
  a: Pick<CardWithCollectionInfo, "setId" | "cardSetId" | "cardName">,
  b: Pick<CardWithCollectionInfo, "setId" | "cardSetId" | "cardName">
): number {
  if (a.setId === b.setId) {
    const spA = isSP(a.cardName);
    const spB = isSP(b.cardName);
    if (spA !== spB) return spA ? 1 : -1;
  }

  const byCode = a.cardSetId.localeCompare(b.cardSetId, undefined, { numeric: true });
  if (byCode !== 0) return byCode;

  const altA = isAltArt(a.cardName) && !isSP(a.cardName);
  const altB = isAltArt(b.cardName) && !isSP(b.cardName);
  if (altA !== altB) return altA ? 1 : -1;

  return 0;
}

// Reprint: carta cujo código impresso não bate com o próprio set onde ela
// está catalogada (ex: "OP12-108" reimpressa dentro do set "OP-14", como
// bônus/promo de pré-venda). O prefixo esperado é o id do set sem hífen
// ("OP-14" -> "OP14-", "EB-04" -> "EB04-").
export function isReprint(cardSetId: string, setId: string): boolean {
  return !cardSetId.startsWith(`${setId.replace(/-/g, "")}-`);
}

export type SetOwnershipStats = {
  baseOwned: number;
  baseTotal: number;
  fullOwned: number;
  fullTotal: number;
};

// "Base set" (BS) conta só as cartas do próprio set, sem alt art e sem
// reprints de outros sets; "full set" (FS) conta todas — usado na aba "Por
// Set" pra mostrar quanto da coleção de cada set o usuário já tem. Alt art
// e reprint recebem o mesmo tratamento de propósito: contam pro FS, nunca
// pro BS.
export function computeSetOwnershipStats(
  cards: Pick<CardWithCollectionInfo, "cardName" | "cardSetId" | "quantity">[],
  setId: string
): SetOwnershipStats {
  let baseOwned = 0;
  let baseTotal = 0;
  let fullOwned = 0;
  let fullTotal = 0;

  for (const card of cards) {
    fullTotal++;
    if (card.quantity > 0) fullOwned++;

    if (!isAltArt(card.cardName) && !isReprint(card.cardSetId, setId)) {
      baseTotal++;
      if (card.quantity > 0) baseOwned++;
    }
  }

  return { baseOwned, baseTotal, fullOwned, fullTotal };
}
