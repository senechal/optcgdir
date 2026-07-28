import { describe, it, expect } from "vitest";
import { stripVariantSuffix, cardmarketUrl } from "./cardDisplay";
import type { CardWithCollectionInfo } from "./dashboardTypes";

function card(overrides: Partial<CardWithCollectionInfo>): CardWithCollectionInfo {
  return {
    cardImageId: "OP01-001",
    cardSetId: "OP01-001",
    cardName: "Monkey.D.Luffy",
    cardColor: "Red",
    cardType: "Leader",
    rarity: "L",
    cardCost: null,
    cardPower: null,
    counterAmount: null,
    setId: "OP-01",
    localImagePath: null,
    isParallel: false,
    sourceType: "booster",
    quantity: 0,
    wantsTrade: false,
    allocatedInDecks: 0,
    ...overrides,
  };
}

describe("stripVariantSuffix", () => {
  it("removes a trailing parenthesized suffix", () => {
    expect(stripVariantSuffix("Nami (Parallel)")).toBe("Nami");
  });

  it("removes a trailing parenthesized suffix with nested-looking content", () => {
    expect(stripVariantSuffix("Enel (Alternative Art)")).toBe("Enel");
  });

  it("leaves a name with no parenthesized suffix unchanged", () => {
    expect(stripVariantSuffix("Monkey.D.Luffy")).toBe("Monkey.D.Luffy");
  });

  it("only strips a suffix at the very end, not parens in the middle", () => {
    expect(stripVariantSuffix("Sengoku (060)")).toBe("Sengoku");
  });
});

describe("cardmarketUrl", () => {
  it("uses 'Promo' as the variant for promo cards regardless of isParallel", () => {
    const url = cardmarketUrl(card({ sourceType: "promo", isParallel: true, cardName: "Chopper", cardSetId: "P-101" }));
    expect(url).toContain(encodeURIComponent("Chopper P-101 Promo"));
  });

  it("uses 'V.2' for non-promo parallel (alt-art) cards", () => {
    const url = cardmarketUrl(card({ sourceType: "booster", isParallel: true, cardName: "Nami (Parallel)", cardSetId: "OP15-086" }));
    expect(url).toContain(encodeURIComponent("Nami OP15-086 V.2"));
  });

  it("uses 'V.1' for non-promo, non-parallel cards", () => {
    const url = cardmarketUrl(card({ sourceType: "booster", isParallel: false, cardName: "Monkey.D.Luffy", cardSetId: "OP01-001" }));
    expect(url).toContain(encodeURIComponent("Monkey.D.Luffy OP01-001 V.1"));
  });

  it("builds a well-formed, fully-encoded Cardmarket search URL", () => {
    const url = cardmarketUrl(card({ cardName: "Kid & Killer", cardSetId: "EB01-003" }));
    expect(url).toBe(
      `https://www.cardmarket.com/en/OnePiece/Products/Search?searchString=${encodeURIComponent("Kid & Killer EB01-003 V.1")}`
    );
  });
});
