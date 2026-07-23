// Casa o texto extraído por OCR de uma foto de carta contra o catálogo já
// sincronizado no Postgres. Sem biblioteca de fuzzy-match — o catálogo é
// pequeno (poucos milhares de cartas) e o sinal mais forte (código impresso
// da carta) já resolve a maior parte dos casos sozinho.

export type MatchableCard = {
  cardImageId: string;
  cardSetId: string;
  cardName: string;
  cardType: string;
  rarity: string | null;
  isParallel: boolean;
  sourceType: string;
  localImagePath: string | null;
};

export type CardMatch = MatchableCard & { score: number };

const CARD_CODE_PATTERN = /[A-Z]{1,4}\d{0,2}-\d{3}/g;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist: number[][] = Array.from({ length: rows }, (_, i) => [
    i,
    ...Array(cols - 1).fill(0),
  ]);
  for (let j = 1; j < cols; j++) dist[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(
        dist[i - 1][j] + 1,
        dist[i][j - 1] + 1,
        dist[i - 1][j - 1] + cost
      );
    }
  }
  return dist[rows - 1][cols - 1];
}

function similarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function bestLineSimilarity(cardName: string, ocrLines: string[]): number {
  let best = 0;
  for (const line of ocrLines) {
    if (!line) continue;
    best = Math.max(best, similarity(cardName, line));
  }
  return best;
}

function tokenOverlapRatio(cardName: string, ocrBlob: string): number {
  const tokens = cardName.split(" ").filter((t) => t.length >= 3);
  if (tokens.length === 0) return 0;
  const matched = tokens.filter((t) => ocrBlob.includes(t)).length;
  return matched / tokens.length;
}

export function rankCardsByOcrText(
  ocrText: string,
  cards: MatchableCard[],
  limit = 8
): CardMatch[] {
  const codeMatches = new Set(ocrText.toUpperCase().match(CARD_CODE_PATTERN) ?? []);
  const ocrBlob = normalize(ocrText);
  const ocrLines = ocrText.split(/\r?\n/).map(normalize);

  const scored: CardMatch[] = cards.map((card) => {
    const normalizedName = normalize(card.cardName);
    const codeBonus = codeMatches.has(card.cardSetId) ? 100 : 0;
    const tokenRatio = tokenOverlapRatio(normalizedName, ocrBlob);
    const lineSim = bestLineSimilarity(normalizedName, ocrLines);
    const score = codeBonus + tokenRatio * 40 + lineSim * 30;
    return { ...card, score };
  });

  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
