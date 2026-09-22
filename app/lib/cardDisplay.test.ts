import { describe, it, expect } from "vitest";
import {
  stripVariantSuffix,
  cardmarketUrl,
  isAltArt,
  isSP,
  isReprint,
  computeSetOwnershipStats,
  compareCardsForDisplay,
} from "./cardDisplay";
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

  it("returns true for the 'Super Alternate Art' variants", () => {
    expect(isAltArt("Sabo (120) (Super Alternate Art)")).toBe(true);
    expect(isAltArt("Portgas.D.Ace (119) (Red Super Alternate Art)")).toBe(true);
    expect(isAltArt("Monkey.D.Luffy (Super Leader Alternate Art)")).toBe(true);
  });

  it("returns true for the other variants that repeat a card's code", () => {
    for (const name of [
      "Nami (P-053) (Full Art)",
      "Slow-Slow Beam Sword (Pirate Foil)",
      "Eustass\"Captain\"Kid (Jolly Roger Foil)",
      "Kid (Textured Foil)",
      "Perona (Box Topper)",
      "Kalifa (Dash Pack)",
      "Doflamingo (Wanted Poster)",
      "Otama (Reprint)",
      "Portgas.D.Ace (TR)",
    ]) {
      expect(isAltArt(name)).toBe(true);
    }
  });

  it("doesn't treat character-name suffixes as alt art", () => {
    expect(isAltArt("Zephyr (Navy)")).toBe(false);
    expect(isAltArt("Mr.3 (Galdino)")).toBe(false);
    expect(isAltArt("Sengoku (060)")).toBe(false);
  });

  it("returns true when the name contains 'Pandaman Art'", () => {
    expect(isAltArt("Kingdew (Pandaman Art)")).toBe(true);
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

describe("isSP", () => {
  it("returns true for the '(SP)' marker", () => {
    expect(isSP("Boa Hancock - OP14-112 (SP)")).toBe(true);
  });

  it("returns false for a plain or alt-art name", () => {
    expect(isSP("Monkey.D.Luffy")).toBe(false);
    expect(isSP("Boa Hancock - OP14-112 (Alternate Art)")).toBe(false);
  });
});

describe("compareCardsForDisplay", () => {
  function c(overrides: Partial<CardWithCollectionInfo>) {
    return card({ cardSetId: "OP14-001", setId: "OP-14", ...overrides });
  }

  it("orders by printed code first, grouping a card with its variants", () => {
    const a = c({ cardImageId: "a", cardSetId: "OP14-001" });
    const b = c({ cardImageId: "b", cardSetId: "OP14-002" });
    expect(compareCardsForDisplay(a, b)).toBeLessThan(0);
    expect(compareCardsForDisplay(b, a)).toBeGreaterThan(0);
  });

  it("within the same code, sorts the common version before its alt art", () => {
    const base = c({ cardImageId: "a", cardName: "Trafalgar Law" });
    const alt = c({ cardImageId: "b", cardName: "Trafalgar Law (Alternate Art)" });
    expect(compareCardsForDisplay(base, alt)).toBeLessThan(0);
    expect(compareCardsForDisplay(alt, base)).toBeGreaterThan(0);
  });

  it("within the same set, sorts SP after every other card regardless of its own code", () => {
    const sp = c({ cardImageId: "a", cardSetId: "OP14-001", cardName: "Boa Hancock (SP)" });
    const laterCodeNonSp = c({ cardImageId: "b", cardSetId: "OP14-090", cardName: "Someone Else" });
    expect(compareCardsForDisplay(sp, laterCodeNonSp)).toBeGreaterThan(0);
    expect(compareCardsForDisplay(laterCodeNonSp, sp)).toBeLessThan(0);
  });

  it("does not apply the SP-last rule across different sets", () => {
    const spInSetA = c({ cardImageId: "a", setId: "OP-14", cardSetId: "OP14-001", cardName: "Boa Hancock (SP)" });
    const nonSpInSetB = c({ cardImageId: "b", setId: "OP-15", cardSetId: "OP14-001", cardName: "Someone Else" });
    // Mesmo código impresso (reprint bônus) mas sets diferentes: a regra de SP não atravessa sets, só o código decide.
    expect(compareCardsForDisplay(spInSetA, nonSpInSetB)).toBe(0);
  });

  it("returns 0 for two otherwise-identical cards", () => {
    const a = c({ cardImageId: "a" });
    const b = c({ cardImageId: "b" });
    expect(compareCardsForDisplay(a, b)).toBe(0);
  });
});
