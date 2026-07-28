import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "../test-utils";
import CardTile from "./CardTile";
import type { CardWithCollectionInfo } from "../lib/dashboardTypes";

function card(overrides: Partial<CardWithCollectionInfo> = {}): CardWithCollectionInfo {
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

describe("CardTile", () => {
  it("shows a placeholder block instead of an image when there's no local image", () => {
    const { container } = renderWithIntl(<CardTile card={card()} onMutate={vi.fn()} onEnlarge={vi.fn()} />);
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("Monkey.D.Luffy")).toBeInTheDocument();
  });

  it("renders the card image and opens the enlarge modal on click when a local image exists", () => {
    const onEnlarge = vi.fn();
    const c = card({ localImagePath: "OP01-001.png" });
    renderWithIntl(<CardTile card={c} onMutate={vi.fn()} onEnlarge={onEnlarge} />);
    fireEvent.click(screen.getByTitle("Ver imagem maior"));
    expect(onEnlarge).toHaveBeenCalledWith(c);
  });

  it("hides the quantity line entirely when quantity is 0", () => {
    renderWithIntl(<CardTile card={card({ quantity: 0 })} onMutate={vi.fn()} onEnlarge={vi.fn()} />);
    expect(screen.queryByText(/Qtd:/)).not.toBeInTheDocument();
  });

  it("shows quantity without a duplicate marker when quantity is exactly 1", () => {
    renderWithIntl(<CardTile card={card({ quantity: 1 })} onMutate={vi.fn()} onEnlarge={vi.fn()} />);
    expect(screen.getByText("Qtd: 1")).toBeInTheDocument();
    expect(screen.queryByText(/duplicata/)).not.toBeInTheDocument();
  });

  it("marks it as a duplicate when quantity is greater than 1", () => {
    renderWithIntl(<CardTile card={card({ quantity: 3 })} onMutate={vi.fn()} onEnlarge={vi.fn()} />);
    expect(screen.getByText(/Qtd: 3/)).toHaveTextContent("· duplicata");
  });

  it("hides the in-deck count when allocatedInDecks is 0", () => {
    renderWithIntl(<CardTile card={card({ allocatedInDecks: 0 })} onMutate={vi.fn()} onEnlarge={vi.fn()} />);
    expect(screen.queryByText(/em deck/)).not.toBeInTheDocument();
  });

  it("shows the in-deck count when allocatedInDecks is greater than 0", () => {
    renderWithIntl(<CardTile card={card({ allocatedInDecks: 2 })} onMutate={vi.fn()} onEnlarge={vi.fn()} />);
    expect(screen.getByText("2 em decks")).toBeInTheDocument();
  });

  it("dims the wants-trade toggle when the card isn't marked for trade", () => {
    renderWithIntl(<CardTile card={card({ wantsTrade: false })} onMutate={vi.fn()} onEnlarge={vi.fn()} />);
    const btn = screen.getByTitle("Quero trocar");
    expect(btn.style.opacity).toBe("0.35");
  });

  it("highlights the wants-trade toggle when the card is marked for trade", () => {
    renderWithIntl(<CardTile card={card({ wantsTrade: true })} onMutate={vi.fn()} onEnlarge={vi.fn()} />);
    const btn = screen.getByTitle("Quero trocar");
    expect(btn.style.opacity).toBe("1");
  });

  it("calls onMutate with the right action for each icon button", () => {
    const onMutate = vi.fn();
    const c = card({ cardImageId: "XYZ-1" });
    renderWithIntl(<CardTile card={c} onMutate={onMutate} onEnlarge={vi.fn()} />);
    fireEvent.click(screen.getByTitle("Remover 1"));
    fireEvent.click(screen.getByTitle("Adicionar 1"));
    fireEvent.click(screen.getByTitle("Quero trocar"));
    expect(onMutate).toHaveBeenNthCalledWith(1, "XYZ-1", "decrement");
    expect(onMutate).toHaveBeenNthCalledWith(2, "XYZ-1", "increment");
    expect(onMutate).toHaveBeenNthCalledWith(3, "XYZ-1", "toggleWantsTrade");
  });

  it("links to Cardmarket with the search string built from the card's data", () => {
    const c = card({ cardName: "Nami (Parallel)", cardSetId: "OP15-086", isParallel: true });
    renderWithIntl(<CardTile card={c} onMutate={vi.fn()} onEnlarge={vi.fn()} />);
    const link = screen.getByText("Ver no Cardmarket ↗") as HTMLAnchorElement;
    expect(link.href).toContain(encodeURIComponent("Nami OP15-086 V.2"));
  });
});
