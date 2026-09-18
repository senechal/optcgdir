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
// "Kouzuki Oden (SPR)", "Borsalino (Manga)"). Parallel/SPR/Manga contam como
// alt art neste sistema, não só "Alternate Art" em si. Lista compartilhada
// com o filtro "Ocultar alt arts" (app/app/page.tsx) pra não duplicar os
// textos em dois lugares.
export const ALT_ART_MARKERS = ["Alternate Art", "Parallel", "SPR", "Manga"];

export function isAltArt(cardName: string): boolean {
  const lowerName = cardName.toLowerCase();
  return ALT_ART_MARKERS.some((marker) => lowerName.includes(marker.toLowerCase()));
}

export type SetOwnershipStats = {
  baseOwned: number;
  baseTotal: number;
  fullOwned: number;
  fullTotal: number;
};

// "Base set" (BS) conta só as cartas sem alt art; "full set" (FS) conta
// todas, alt art incluída — usado na aba "Por Set" pra mostrar quanto da
// coleção de cada set o usuário já tem.
export function computeSetOwnershipStats(
  cards: Pick<CardWithCollectionInfo, "cardName" | "quantity">[]
): SetOwnershipStats {
  let baseOwned = 0;
  let baseTotal = 0;
  let fullOwned = 0;
  let fullTotal = 0;

  for (const card of cards) {
    fullTotal++;
    if (card.quantity > 0) fullOwned++;

    if (!isAltArt(card.cardName)) {
      baseTotal++;
      if (card.quantity > 0) baseOwned++;
    }
  }

  return { baseOwned, baseTotal, fullOwned, fullTotal };
}
