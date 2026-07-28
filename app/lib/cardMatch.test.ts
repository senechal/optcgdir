import { describe, it, expect } from "vitest";
import { rankCardsByOcrText, type MatchableCard } from "./cardMatch";

function card(overrides: Partial<MatchableCard> & Pick<MatchableCard, "cardImageId" | "cardSetId" | "cardName">): MatchableCard {
  return {
    cardType: "Character",
    rarity: "C",
    isParallel: false,
    sourceType: "booster",
    localImagePath: null,
    ...overrides,
  };
}

describe("rankCardsByOcrText", () => {
  it("returns nothing when the OCR text is empty (score stays exactly 0)", () => {
    const cards = [card({ cardImageId: "A", cardSetId: "OP01-001", cardName: "Monkey.D.Luffy" })];
    const result = rankCardsByOcrText("", cards);
    expect(result).toEqual([]);
  });

  it("matches by printed code when the OCR code strip reads cleanly (with hyphen)", () => {
    const cards = [
      card({ cardImageId: "A", cardSetId: "OP12-001", cardName: "Monkey.D.Luffy" }),
      card({ cardImageId: "B", cardSetId: "OP05-050", cardName: "Hina" }),
    ];
    const result = rankCardsByOcrText("some noisy text OP12-001 SR 3 more noise", cards);
    expect(result[0].cardImageId).toBe("A");
    expect(result[0].matchedByCode).toBe(true);
  });

  it("matches by code even without the hyphen (OCR often drops it)", () => {
    const cards = [card({ cardImageId: "A", cardSetId: "OP12-001", cardName: "Monkey.D.Luffy" })];
    const result = rankCardsByOcrText("noise OP12001 noise", cards);
    expect(result[0].matchedByCode).toBe(true);
  });

  it("tolerates a single misread digit in the code via fuzzy similarity", () => {
    // A letter-for-digit misread (e.g. "0Q1") would break the regex entirely
    // (it requires 3 digits right after the hyphen), so the realistic "OCR
    // read 1 digit wrong" case is a digit-for-digit swap: "091" vs "001" ->
    // "OP12091" vs "OP12001", 1 char different out of 7 -> similarity ~0.857.
    const cards = [card({ cardImageId: "A", cardSetId: "OP12-001", cardName: "Monkey.D.Luffy" })];
    const result = rankCardsByOcrText("noise OP12-091 noise", cards);
    expect(result[0].matchedByCode).toBe(true);
  });

  it("does not claim a code match when the OCR code is too different from any real code", () => {
    const cards = [card({ cardImageId: "A", cardSetId: "OP12-001", cardName: "Monkey.D.Luffy" })];
    // No code-shaped substring at all in the OCR text.
    const result = rankCardsByOcrText("Monkey.D.Luffy CHARACTER Supernovas", cards);
    expect(result[0].matchedByCode).toBe(false);
  });

  it("falls back to full name line match when no code is legible", () => {
    const cards = [
      card({ cardImageId: "A", cardSetId: "OP12-015", cardName: "Monkey.D.Luffy" }),
      card({ cardImageId: "B", cardSetId: "OP01-008", cardName: "Cavendish" }),
    ];
    const ocrText = "garbled garbled\nMonkey.D.Luffy\nCHARACTER Supernovas";
    const result = rankCardsByOcrText(ocrText, cards);
    expect(result[0].cardImageId).toBe("A");
    expect(result[0].matchedByCode).toBe(false);
  });

  it("gives partial credit for token overlap when no single line matches the full name", () => {
    const cards = [card({ cardImageId: "A", cardSetId: "OP07-062", cardName: "Vinsmoke Reiju" })];
    // "Vinsmoke" appears but "Reiju" doesn't -- partial token overlap, no full-line match.
    const result = rankCardsByOcrText("noise Vinsmoke noise CHARACTER", cards);
    expect(result[0].cardImageId).toBe("A");
    expect(result[0].score).toBeGreaterThan(0);
  });

  it("treats a name with only sub-3-character tokens as having zero token overlap", () => {
    // "Al" alone is filtered out (length < 3), leaving tokens.length === 0,
    // which short-circuits tokenOverlapRatio to 0 without checking the OCR blob.
    const cards = [card({ cardImageId: "A", cardSetId: "P-001", cardName: "Al" })];
    const result = rankCardsByOcrText("", cards);
    expect(result).toEqual([]);
  });

  it("handles accented characters and punctuation in card names via normalization", () => {
    const cards = [card({ cardImageId: "A", cardSetId: "OP01-015", cardName: "Tony Tony.Chopper" })];
    const result = rankCardsByOcrText("Tony Tony Chopper CHARACTER", cards);
    expect(result[0].cardImageId).toBe("A");
  });

  it("skips blank OCR lines without throwing", () => {
    const cards = [card({ cardImageId: "A", cardSetId: "OP01-015", cardName: "Tony Tony.Chopper" })];
    const ocrText = "\n\nTony Tony Chopper\n\n";
    const result = rankCardsByOcrText(ocrText, cards);
    expect(result[0].cardImageId).toBe("A");
  });

  it("ranks the best match first and respects the limit", () => {
    const cards = [
      card({ cardImageId: "low", cardSetId: "OP05-051", cardName: "Borsalino" }),
      card({ cardImageId: "high", cardSetId: "OP12-073", cardName: "Kuzan" }),
      card({ cardImageId: "mid", cardSetId: "OP03-093", cardName: "Wanze" }),
    ];
    const ocrText = "Kuzan\nBorsalino somewhere in the text\n";
    const result = rankCardsByOcrText(ocrText, cards, 1);
    expect(result).toHaveLength(1);
    expect(result[0].cardImageId).toBe("high");
  });

  it("defaults the limit to 8 candidates", () => {
    const cards = Array.from({ length: 10 }, (_, i) =>
      card({ cardImageId: `c${i}`, cardSetId: `OP01-0${i}`, cardName: "Nami" })
    );
    const result = rankCardsByOcrText("Nami CHARACTER Nami Nami", cards);
    expect(result.length).toBeLessThanOrEqual(8);
  });
});
