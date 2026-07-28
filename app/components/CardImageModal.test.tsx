import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "../test-utils";
import CardImageModal from "./CardImageModal";
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

describe("CardImageModal", () => {
  it("shows the card name and code", () => {
    renderWithIntl(<CardImageModal card={card()} onClose={vi.fn()} />);
    expect(screen.getByText("Monkey.D.Luffy")).toBeInTheDocument();
    expect(screen.getByText("OP01-001")).toBeInTheDocument();
  });

  it("shows a placeholder block when there's no local image", () => {
    const { container } = renderWithIntl(<CardImageModal card={card()} onClose={vi.fn()} />);
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("calls onClose when clicking the backdrop", () => {
    const onClose = vi.fn();
    const { container } = renderWithIntl(<CardImageModal card={card()} onClose={onClose} />);
    fireEvent.click(container.querySelector(".card-modal-backdrop")!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose when clicking inside the panel", () => {
    const onClose = vi.fn();
    const { container } = renderWithIntl(<CardImageModal card={card()} onClose={onClose} />);
    fireEvent.click(container.querySelector(".card-modal-panel")!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when clicking the close button", () => {
    const onClose = vi.fn();
    renderWithIntl(<CardImageModal card={card()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Fechar"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when pressing Escape", () => {
    const onClose = vi.fn();
    renderWithIntl(<CardImageModal card={card()} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("ignores other key presses", () => {
    const onClose = vi.fn();
    renderWithIntl(<CardImageModal card={card()} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("locks body scroll while mounted and restores it on unmount", () => {
    const original = document.body.style.overflow;
    const { unmount } = renderWithIntl(<CardImageModal card={card()} onClose={vi.fn()} />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe(original);
  });
});
