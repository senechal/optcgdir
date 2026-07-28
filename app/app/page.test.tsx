// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

// Mocado (em vez de importar o Dashboard de verdade) pra este teste focar
// só na lógica de preparação de dados de page.tsx — importar o componente
// real puxaria LocaleSwitcher -> actions/setLocale -> i18n/request, que
// chama getRequestConfig do next-intl/server no topo do módulo (quebraria
// já que aqui mockamos next-intl/server sem esse export). A fábrica do
// vi.mock é hoisted, então a função precisa ser definida dentro dela — não
// pode referenciar uma const externa (TDZ).
vi.mock("../components/Dashboard", () => ({ default: () => null }));

vi.mock("next-intl/server", () => ({
  getLocale: async () => "pt-BR",
  getTranslations: async () => (key: string) => key,
}));

const getDefaultUserId = vi.fn().mockResolvedValue("user-1");
vi.mock("../lib/currentUser", () => ({
  getDefaultUserId: () => getDefaultUserId(),
}));

const findMany = vi.fn();
const setFindMany = vi.fn().mockResolvedValue([]);
vi.mock("../lib/prisma", () => ({
  prisma: {
    card: { findMany: (...args: unknown[]) => findMany(...args) },
    set: { findMany: (...args: unknown[]) => setFindMany(...args) },
  },
}));

import Home from "./page";
import DashboardMock from "../components/Dashboard";

function rawCard(overrides: Record<string, unknown> = {}) {
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
    collectionItems: [],
    deckCards: [],
    ...overrides,
  };
}

async function homeProps(searchParams: Record<string, string | string[] | undefined> = {}) {
  const element = (await Home({ searchParams })) as ReactElement<any>;
  expect(element.type).toBe(DashboardMock);
  return element.props;
}

describe("Home (page.tsx)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDefaultUserId.mockResolvedValue("user-1");
    setFindMany.mockResolvedValue([]);
    findMany.mockImplementation((args: any) => {
      // A 1ª chamada é o findMany principal (com where/include); as
      // outras duas são os distinct de rarity/cardType.
      if (args?.distinct?.[0] === "rarity") return Promise.resolve([{ rarity: "L" }, { rarity: null }]);
      if (args?.distinct?.[0] === "cardType") return Promise.resolve([{ cardType: "Leader" }]);
      return Promise.resolve([rawCard()]);
    });
  });

  it("defaults to tab=all, view=grid, sort=code with no search params", async () => {
    const props = await homeProps({});
    expect(props.tab).toBe("all");
    expect(props.view).toBe("grid");
    expect(props.currentParams).toEqual({});
  });

  it("computes quantity/wantsTrade/allocatedInDecks from the raw collection/deck rows", async () => {
    findMany.mockImplementation((args: any) => {
      if (args?.distinct) return Promise.resolve([]);
      return Promise.resolve([
        rawCard({
          collectionItems: [{ quantity: 2 }, { quantity: 1, wantsTrade: true }],
          deckCards: [{ quantity: 3 }],
        }),
      ]);
    });
    const props = await homeProps({});
    expect(props.cards[0].quantity).toBe(3);
    expect(props.cards[0].wantsTrade).toBe(true);
    expect(props.cards[0].allocatedInDecks).toBe(3);
  });

  it("passes color/rarity/type/set filters through to the Prisma where clause", async () => {
    await homeProps({ color: "Red", rarity: "L", type: "Leader", set: "OP-01" });
    const mainCall = findMany.mock.calls.find((c) => c[0]?.where !== undefined);
    expect(mainCall[0].where).toEqual({
      cardColor: { contains: "Red", mode: "insensitive" },
      rarity: "L",
      cardType: "Leader",
      setId: "OP-01",
    });
  });

  it("builds a multi-field OR clause when searching", async () => {
    await homeProps({ search: "Luffy" });
    const mainCall = findMany.mock.calls.find((c) => c[0]?.where !== undefined);
    expect(mainCall[0].where.OR).toHaveLength(4);
  });

  it("only forces onlyOwned/groupBySet based on tab, not on unrelated params", async () => {
    findMany.mockImplementation((args: any) => {
      if (args?.distinct) return Promise.resolve([]);
      return Promise.resolve([
        rawCard({ cardImageId: "owned", collectionItems: [{ quantity: 1 }] }),
        rawCard({ cardImageId: "not-owned", collectionItems: [] }),
      ]);
    });
    const props = await homeProps({ tab: "owned" });
    expect(props.cards.map((c: any) => c.cardImageId)).toEqual(["owned"]);
  });

  it("filters to duplicates only in the duplicates tab", async () => {
    findMany.mockImplementation((args: any) => {
      if (args?.distinct) return Promise.resolve([]);
      return Promise.resolve([
        rawCard({ cardImageId: "dup", collectionItems: [{ quantity: 2 }] }),
        rawCard({ cardImageId: "single", collectionItems: [{ quantity: 1 }] }),
      ]);
    });
    const props = await homeProps({ tab: "duplicates" });
    expect(props.cards.map((c: any) => c.cardImageId)).toEqual(["dup"]);
  });

  it("filters to wants-trade only in the wantsTrade tab", async () => {
    findMany.mockImplementation((args: any) => {
      if (args?.distinct) return Promise.resolve([]);
      return Promise.resolve([
        rawCard({ cardImageId: "trade", collectionItems: [{ quantity: 1, wantsTrade: true }] }),
        rawCard({ cardImageId: "no-trade", collectionItems: [{ quantity: 1, wantsTrade: false }] }),
      ]);
    });
    const props = await homeProps({ tab: "wantsTrade" });
    expect(props.cards.map((c: any) => c.cardImageId)).toEqual(["trade"]);
  });

  it("groups by set (passes tab through) only for the 'grouped' tab", async () => {
    const grouped = await homeProps({ tab: "grouped" });
    expect(grouped.tab).toBe("grouped");
    const all = await homeProps({ tab: "all" });
    expect(all.tab).toBe("all");
  });

  it("filters numerically on cost/power ranges", async () => {
    findMany.mockImplementation((args: any) => {
      if (args?.distinct) return Promise.resolve([]);
      return Promise.resolve([
        rawCard({ cardImageId: "cheap", cardCost: "2" }),
        rawCard({ cardImageId: "expensive", cardCost: "9" }),
      ]);
    });
    const props = await homeProps({ costMin: "5" });
    expect(props.cards.map((c: any) => c.cardImageId)).toEqual(["expensive"]);
  });

  it("excludes cards with a null numeric field when a range filter is active", async () => {
    findMany.mockImplementation((args: any) => {
      if (args?.distinct) return Promise.resolve([]);
      return Promise.resolve([rawCard({ cardImageId: "no-cost", cardCost: null })]);
    });
    const props = await homeProps({ costMin: "1" });
    expect(props.cards).toEqual([]);
  });

  it("sorts code-matches before name-matches when searching", async () => {
    findMany.mockImplementation((args: any) => {
      if (args?.distinct) return Promise.resolve([]);
      return Promise.resolve([
        rawCard({ cardImageId: "by-name", cardSetId: "OP05-050", cardName: "has Luffy in the effect text" }),
        rawCard({ cardImageId: "by-code", cardSetId: "LUFFY-001", cardName: "Something Else" }),
      ]);
    });
    const props = await homeProps({ search: "luffy" });
    expect(props.cards[0].cardImageId).toBe("by-code");
  });

  it("falls back to the code sorter for an unrecognized sort value", async () => {
    findMany.mockImplementation((args: any) => {
      if (args?.distinct) return Promise.resolve([]);
      return Promise.resolve([
        rawCard({ cardImageId: "b", cardSetId: "OP01-002" }),
        rawCard({ cardImageId: "a", cardSetId: "OP01-001" }),
      ]);
    });
    const props = await homeProps({ sort: "not-a-real-sorter" });
    expect(props.cards.map((c: any) => c.cardImageId)).toEqual(["a", "b"]);
  });

  it("builds filterOptions from the distinct rarity/type rows, dropping nulls", async () => {
    const props = await homeProps({});
    expect(props.filterOptions.rarities).toEqual(["L"]);
    expect(props.filterOptions.types).toEqual(["Leader"]);
    expect(props.filterOptions.colors).toEqual([
      { value: "Red", label: "Red" },
      { value: "Green", label: "Green" },
      { value: "Blue", label: "Blue" },
      { value: "Purple", label: "Purple" },
      { value: "Black", label: "Black" },
      { value: "Yellow", label: "Yellow" },
    ]);
  });

  it("keeps only the truthy, first-of-array search params in currentParams", async () => {
    const props = await homeProps({ color: ["Red", "Blue"], rarity: "", search: undefined });
    expect(props.currentParams).toEqual({ color: "Red" });
  });
});
