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

export type CardMatch = MatchableCard & { score: number; matchedByCode: boolean };

// Hífen fica opcional: o OCR do rodapé da carta (canto onde o código fica
// impresso, ex: "OP12-001") frequentemente perde esse traço na binarização
// — quem compara os dois lados remove o hífen antes, então não faz
// diferença se o texto reconhecido veio como "OP12001" ou "OP12-001".
const CARD_CODE_PATTERN = /[A-Z]{1,4}\d{0,2}-?\d{3}/g;

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
  // Guarda contra divisão por zero (maxLen=0) se algum dia essa função for
  // chamada com as duas strings vazias — não ocorre pelos dois chamadores
  // atuais (bestLineSimilarity pula linha vazia antes de chegar aqui, e
  // bestCodeSimilarity só itera sobre candidatos que o regex já garante
  // não-vazios), por isso o branch abaixo é inatingível pelos testes.
  /* v8 ignore next */
  if (!a.length && !b.length) return 1;
  const maxLen = Math.max(a.length, b.length);
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

function bestCodeSimilarity(candidates: string[], code: string): number {
  let best = 0;
  for (const candidate of candidates) {
    best = Math.max(best, similarity(candidate, code));
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
  const codeCandidates = (ocrText.toUpperCase().match(CARD_CODE_PATTERN) ?? []).map((code) =>
    code.replace(/-/g, "")
  );
  const ocrBlob = normalize(ocrText);
  const ocrLines = ocrText.split(/\r?\n/).map(normalize);

  // Match exato ideal, mas o OCR de um canto pequeno da carta erra 1
  // caractere com facilidade (ex: "O" lido como "Q") — aceita quase-match
  // em vez de exigir igualdade perfeita, senão esse erro sozinho já
  // descarta o candidato certo.
  const CODE_SIMILARITY_THRESHOLD = 0.8;

  const scored: CardMatch[] = cards.map((card) => {
    const normalizedName = normalize(card.cardName);
    const codeSimilarity = bestCodeSimilarity(codeCandidates, card.cardSetId.replace(/-/g, ""));
    const matchedByCode = codeSimilarity >= CODE_SIMILARITY_THRESHOLD;
    const codeBonus = matchedByCode ? codeSimilarity * 100 : 0;
    const tokenRatio = tokenOverlapRatio(normalizedName, ocrBlob);
    const lineSim = bestLineSimilarity(normalizedName, ocrLines);
    // Testado contra 28 fotos reais categorizadas: bestLineSimilarity (nome
    // inteiro vs. uma linha do OCR) prevê a carta certa com bem mais
    // confiabilidade que tokenOverlapRatio (que reage a qualquer palavra
    // solta reconhecida em qualquer lugar do blob, inclusive em cartas
    // erradas) — por isso o peso da linha subiu bem acima do de token.
    const score = codeBonus + tokenRatio * 15 + lineSim * 60;
    return { ...card, score, matchedByCode };
  });

  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
