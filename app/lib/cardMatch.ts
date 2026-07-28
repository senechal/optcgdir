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
// Últimos 2-3 dígitos (não só 3): mesmo o PaddleOCR, bem mais preciso que o
// Tesseract, às vezes perde 1 caractere do final (ex: "OP15-08" em vez de
// "OP15-086") — exigir os 3 dígitos completos descartava o candidato de
// código inteiro nesse caso, deixando o desempate só por nome (que não
// resolve quando várias cartas diferentes têm o mesmo nome em sets
// diferentes, ex: várias impressões de "Nami").
const CARD_CODE_PATTERN = /[A-Z]{1,4}\d{0,2}-?\d{2,3}/g;

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

// A similaridade de Levenshtein pune códigos curtos com muito mais força
// que longos: perder o último dígito de "op15086" (7 chars) ainda dá 0.86
// de similaridade, mas perder o de um código curto tipo "p101" (4 chars)
// derruba pra 0.75 — abaixo do threshold, mesmo sendo exatamente o mesmo
// tipo de erro de OCR. Detecta esse caso à parte: candidato é um prefixo
// exato do código real, faltando só o último caractere. Na pior das
// hipóteses existem 10 cartas reais com esse mesmo prefixo (um dígito a
// mais), e a comparação por nome (lineSim/tokenRatio) desempata entre elas.
// Sem guarda de tamanho mínimo: CARD_CODE_PATTERN já garante candidatos com
// pelo menos 3 caracteres (1 letra + 2 dígitos), então um prefixo válido só
// existe a partir de um código real de 4+ caracteres — curto demais pra um
// prefixo de 1-2 caracteres virar ruído por acaso.
function hasPrefixMatch(candidates: string[], code: string): boolean {
  return candidates.some((candidate) => candidate.length === code.length - 1 && code.startsWith(candidate));
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

  // Piso de similaridade garantido pra um prefixo exato (só falta o último
  // dígito) — não é 1.0 (isso ficaria indistinguível de um match perfeito
  // de verdade), mas alto o bastante pra sempre cruzar o threshold acima,
  // não importa quão curto seja o código.
  const PREFIX_MATCH_SIMILARITY_FLOOR = 0.9;

  const scored: CardMatch[] = cards.map((card) => {
    const normalizedName = normalize(card.cardName);
    const strippedCode = card.cardSetId.replace(/-/g, "");
    const codeSimilarity = bestCodeSimilarity(codeCandidates, strippedCode);
    const tokenRatio = tokenOverlapRatio(normalizedName, ocrBlob);
    const lineSim = bestLineSimilarity(normalizedName, ocrLines);
    // Um prefixo curto (ex: "p10") pode colidir por acaso com um código de
    // uma carta totalmente diferente, sem nenhuma relação com a foto real —
    // aconteceu de verdade: OCR perdeu o "O" de "OP10-067" (Senor Pink),
    // sobrou "P10-0", e isso por acaso é um prefixo válido de "P-105"
    // (Sabo, carta sem nenhuma relação). Só confia no prefixo quando o
    // nome da própria carta também aparece de alguma forma no texto —
    // assim o prefixo só reforça candidatos que o nome já sustenta.
    // lineSim (Levenshtein) quase nunca é exatamente 0 pra duas strings
    // não-vazias, então "lineSim > 0" não filtraria nada de verdade — exige
    // um piso real de parecença, não só "não é zero por coincidência".
    const hasNameSignal = tokenRatio > 0 || lineSim >= 0.5;
    const effectiveCodeSimilarity =
      hasNameSignal && hasPrefixMatch(codeCandidates, strippedCode)
        ? Math.max(codeSimilarity, PREFIX_MATCH_SIMILARITY_FLOOR)
        : codeSimilarity;
    const matchedByCode = effectiveCodeSimilarity >= CODE_SIMILARITY_THRESHOLD;
    const codeBonus = matchedByCode ? effectiveCodeSimilarity * 100 : 0;
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
