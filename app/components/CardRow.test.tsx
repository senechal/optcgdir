import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import { renderWithIntl } from "../test-utils";
import CardRow from "./CardRow";
import { mockIntersectionObservers } from "../vitest.setup";
import type { CardWithCollectionInfo } from "../lib/dashboardTypes";

function card(overrides: Partial<CardWithCollectionInfo> = {}): CardWithCollectionInfo {
  return {
    cardImageId: "OP01-001",
    cardSetId: "OP01-001",
    cardName: "Monkey.D.Luffy",
    cardColor: "Red",
    cardType: "Leader",
    rarity: "L",
    cardCost: "0",
    cardPower: "5000",
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

function renderRow(c: CardWithCollectionInfo, onMutate = vi.fn(), onEnlarge = vi.fn()) {
  return renderWithIntl(
    <table>
      <tbody>
        <CardRow card={c} onMutate={onMutate} onEnlarge={onEnlarge} />
      </tbody>
    </table>
  );
}

describe("CardRow", () => {
  it("shows the card-back placeholder image instead of a real one when there's no local image", () => {
    renderRow(card());
    act(() => mockIntersectionObservers.at(-1)!.trigger(true));
    const img = screen.getByAltText("Monkey.D.Luffy") as HTMLImageElement;
    expect(img.src).toContain("card-back-placeholder.png");
  });

  it("opens the enlarge modal when the thumbnail is clicked, given a local image", () => {
    const onEnlarge = vi.fn();
    const c = card({ localImagePath: "OP01-001.png" });
    renderRow(c, vi.fn(), onEnlarge);
    fireEvent.click(screen.getByTitle("Ver imagem maior"));
    expect(onEnlarge).toHaveBeenCalledWith(c);
  });

  it("shows '-' for cost/power when they're null", () => {
    renderRow(card({ cardCost: null, cardPower: null }));
    const dashes = screen.getAllByText("-");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("shows the actual cost/power values when present", () => {
    renderRow(card({ cardCost: "4", cardPower: "6000" }));
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("6000")).toBeInTheDocument();
  });

  it("shows '-' for in-deck count when allocatedInDecks is 0", () => {
    const { container } = renderRow(card({ allocatedInDecks: 0 }));
    expect(container.querySelector(".col-indeck")).toHaveTextContent("-");
  });

  it("shows the in-deck count when greater than 0", () => {
    const { container } = renderRow(card({ allocatedInDecks: 3 }));
    expect(container.querySelector(".col-indeck")).toHaveTextContent("3");
  });

  it("shows the raw quantity in the col-qty column", () => {
    const { container } = renderRow(card({ quantity: 2 }));
    expect(container.querySelector(".col-qty")).toHaveTextContent("2");
  });

  it("shows the quantity inline in row-meta only when owned", () => {
    const { container } = renderRow(card({ quantity: 0 }));
    expect(container.querySelector(".row-meta")).not.toHaveTextContent("Qtd:");
  });

  it("shows the collection status badge (small size) only when quantity is greater than 0", () => {
    const { container, rerender } = renderRow(card({ quantity: 0 }));
    expect(container.querySelector('[data-testid="collection-status-badge"]')).not.toBeInTheDocument();

    rerender(
      <table>
        <tbody>
          <CardRow card={card({ quantity: 2 })} onMutate={vi.fn()} onEnlarge={vi.fn()} />
        </tbody>
      </table>
    );
    expect(container.querySelector('[data-testid="collection-status-badge"]')).toBeInTheDocument();
  });

  it("calls onMutate with the right action per icon button", () => {
    const onMutate = vi.fn();
    renderRow(card({ cardImageId: "ROW-1" }), onMutate);
    fireEvent.click(screen.getByTitle("Remover 1"));
    fireEvent.click(screen.getByTitle("Adicionar 1"));
    fireEvent.click(screen.getByTitle("Quero trocar"));
    expect(onMutate).toHaveBeenNthCalledWith(1, "ROW-1", "decrement");
    expect(onMutate).toHaveBeenNthCalledWith(2, "ROW-1", "increment");
    expect(onMutate).toHaveBeenNthCalledWith(3, "ROW-1", "toggleWantsTrade");
  });
});
