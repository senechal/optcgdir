import { describe, it, expect } from "vitest";
import { stripVariantSuffix, cardmarketUrl, isAltArt, isReprint, computeSetOwnershipStats } from "./cardDisplay";
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

describe("isAltArt", () => {
  it("returns true when the name contains 'Alternate Art'", () => {
    expect(isAltArt("Kouzuki Oden (Alternate Art)")).toBe(true);
  });

  it("returns true when the name contains 'Parallel'", () => {
    expect(isAltArt("Jack (Parallel)")).toBe(true);
  });

  it("returns true when the name contains 'SPR'", () => {
    expect(isAltArt("Kouzuki Oden (SPR)")).toBe(true);
  });

  it("returns true when the name contains 'Manga'", () => {
    expect(isAltArt("Borsalino (Manga)")).toBe(true);
  });

  it("returns true when the name contains the '(SP)' marker", () => {
    expect(isAltArt("Kid & Killer (SP)")).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(isAltArt("Kouzuki Oden (alternate art)")).toBe(true);
  });

  it("returns false for a plain card name", () => {
    expect(isAltArt("Monkey.D.Luffy")).toBe(false);
  });

  it("doesn't false-positive on names that merely contain 'sp' as a substring", () => {
    expect(isAltArt("Spandam")).toBe(false);
    expect(isAltArt("Special Muggy Ball")).toBe(false);
    expect(isAltArt("Speed Jil")).toBe(false);
  });
});

describe("isReprint", () => {
  it("returns false when the printed code matches the set's own prefix", () => {
    expect(isReprint("OP14-001", "OP-14")).toBe(false);
  });

  it("returns true when the printed code belongs to a different set (bonus reprint)", () => {
    expect(isReprint("OP12-108", "OP-14")).toBe(true);
  });

  it("strips hyphens from the set id to build the expected prefix", () => {
    expect(isReprint("EB04-011", "EB-04")).toBe(false);
    expect(isReprint("EB01-003", "EB-04")).toBe(true);
  });
});

describe("computeSetOwnershipStats", () => {
  it("returns all zeros for an empty set", () => {
    expect(computeSetOwnershipStats([], "OP-01")).toEqual({ baseOwned: 0, baseTotal: 0, fullOwned: 0, fullTotal: 0 });
  });

  it("counts base set (non-alt-art) and full set (all cards) separately", () => {
    const cards = [
      card({ cardImageId: "a", cardName: "Luffy", quantity: 1 }),
      card({ cardImageId: "b", cardName: "Luffy (Alternate Art)", quantity: 0 }),
      card({ cardImageId: "c", cardName: "Zoro", quantity: 0 }),
      card({ cardImageId: "d", cardName: "Zoro (Alternate Art)", quantity: 2 }),
    ];
    expect(computeSetOwnershipStats(cards, "OP-01")).toEqual({ baseOwned: 1, baseTotal: 2, fullOwned: 2, fullTotal: 4 });
  });

  it("excludes reprints from another set out of the base set, but keeps them in the full set", () => {
    const cards = [
      card({ cardImageId: "a", cardName: "Trafalgar Law", cardSetId: "OP14-001", quantity: 1 }),
      card({ cardImageId: "b", cardName: "Crocodile", cardSetId: "OP12-108", quantity: 1 }), // reprint bônus
    ];
    expect(computeSetOwnershipStats(cards, "OP-14")).toEqual({ baseOwned: 1, baseTotal: 1, fullOwned: 2, fullTotal: 2 });
  });
});
