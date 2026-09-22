// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

const findMany = vi.fn().mockResolvedValue([]);
vi.mock("../../lib/prisma", () => ({
  prisma: { card: { findMany: (...args: unknown[]) => findMany(...args) } },
}));

// Mocado pra este teste focar só na lógica de busca de page.tsx, sem
// depender do componente cliente de verdade (mesma razão do Dashboard em
// app/page.test.tsx).
vi.mock("../../components/AdminCardImageEditor", () => ({ default: (props: any) => JSON.stringify(props) }));

import AdminPage from "./page";

async function renderProps(searchParams: Record<string, string | string[] | undefined> = {}) {
  const element = (await AdminPage({ searchParams })) as ReactElement<any>;
  return element;
}

function card(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    cardImageId: "OP01-001",
    cardName: "Monkey.D.Luffy",
    cardSetId: "OP01-001",
    localImagePath: null,
    ...overrides,
  };
}

describe("AdminPage (app/admin/page.tsx)", () => {
  beforeEach(() => {
    findMany.mockClear();
    findMany.mockResolvedValue([]);
  });

  it("doesn't query the catalog when there's no search term", async () => {
    await renderProps({});
    expect(findMany).not.toHaveBeenCalled();
  });

  it("searches by name, cardImageId and cardSetId (case-insensitive) when a term is given", async () => {
    await renderProps({ q: "Luffy" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { cardName: { contains: "Luffy", mode: "insensitive" } },
            { cardImageId: { contains: "Luffy", mode: "insensitive" } },
            { cardSetId: { contains: "Luffy", mode: "insensitive" } },
          ],
        },
      })
    );
  });

  it("caps results at 60 and trims whitespace from the search term", async () => {
    await renderProps({ q: "  Luffy  " });
    const args = findMany.mock.calls[0][0];
    expect(args.take).toBe(60);
    expect(args.where.OR[0].cardName.contains).toBe("Luffy");
  });

  it("only keeps the first value when the query param is repeated", async () => {
    await renderProps({ q: ["Luffy", "Zoro"] });
    expect(findMany.mock.calls[0][0].where.OR[0].cardName.contains).toBe("Luffy");
  });

  it("renders one editor per result, passing through the card's fields", async () => {
    findMany.mockResolvedValue([
      card(),
      card({ id: "f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5", cardImageId: "OP01-002", cardName: "Zoro" }),
    ]);
    const element = await renderProps({ q: "o" });
    const rendered = JSON.stringify(element);
    expect(rendered).toContain("Monkey.D.Luffy");
    expect(rendered).toContain("Zoro");
  });
});
