import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "../test-utils";
import FiltersPanel from "./FiltersPanel";
import type { DraftFilters, FilterOptions } from "../lib/dashboardTypes";

const filterOptions: FilterOptions = {
  sets: [{ id: "OP-01", name: "Romance Dawn" }],
  colors: [{ value: "Red", label: "Vermelho" }],
  rarities: ["L", "SR"],
  types: ["Leader", "Character"],
};

function draft(overrides: Partial<DraftFilters> = {}): DraftFilters {
  return {
    color: "",
    rarity: "",
    type: "",
    set: "",
    costMin: "",
    costMax: "",
    powerMin: "",
    powerMax: "",
    inDeck: false,
    counter: false,
    ...overrides,
  };
}

// Envolve FiltersPanel com estado real de verdade (em vez de um mock inerte
// pra setDraftFilters) — necessário pros testes de <input type="number">,
// já que inspecionar a função updater isolada não reflete de forma
// confiável o valor digitado num input controlado desse tipo em jsdom.
function StatefulFiltersPanel({ onApply = vi.fn() }: { onApply?: () => void }) {
  const [draftFilters, setDraftFilters] = useState<DraftFilters>(draft());
  return (
    <FiltersPanel draftFilters={draftFilters} setDraftFilters={setDraftFilters} filterOptions={filterOptions} onApply={onApply} />
  );
}

describe("FiltersPanel", () => {
  it("reflects the current draft values in the color/rarity/type/set selects", () => {
    renderWithIntl(
      <FiltersPanel
        draftFilters={draft({ color: "Red", rarity: "SR", type: "Character", set: "OP-01" })}
        setDraftFilters={vi.fn()}
        filterOptions={filterOptions}
        onApply={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue("Vermelho")).toBeInTheDocument();
    expect(screen.getByDisplayValue("SR")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Character")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Romance Dawn")).toBeInTheDocument();
  });

  it("updates the color field when the select changes", () => {
    renderWithIntl(<StatefulFiltersPanel />);
    fireEvent.change(screen.getByDisplayValue("Cor: todas"), { target: { value: "Red" } });
    expect(screen.getByDisplayValue("Vermelho")).toBeInTheDocument();
  });

  it("updates costMin/costMax/powerMin/powerMax via their inputs", () => {
    renderWithIntl(<StatefulFiltersPanel />);
    fireEvent.change(screen.getByPlaceholderText("Custo mín."), { target: { value: "2" } });
    expect(screen.getByPlaceholderText("Custo mín.")).toHaveValue(2);

    fireEvent.change(screen.getByPlaceholderText("Custo máx."), { target: { value: "5" } });
    expect(screen.getByPlaceholderText("Custo máx.")).toHaveValue(5);

    fireEvent.change(screen.getByPlaceholderText("Poder mín."), { target: { value: "3000" } });
    expect(screen.getByPlaceholderText("Poder mín.")).toHaveValue(3000);

    fireEvent.change(screen.getByPlaceholderText("Poder máx."), { target: { value: "8000" } });
    expect(screen.getByPlaceholderText("Poder máx.")).toHaveValue(8000);
  });

  it("toggles the inDeck and counter checkboxes", () => {
    renderWithIntl(<StatefulFiltersPanel />);
    const inDeckBox = screen.getByLabelText("Só em algum deck") as HTMLInputElement;
    const counterBox = screen.getByLabelText("Só com counter") as HTMLInputElement;

    fireEvent.click(inDeckBox);
    expect(inDeckBox.checked).toBe(true);
    expect(counterBox.checked).toBe(false);

    fireEvent.click(counterBox);
    expect(counterBox.checked).toBe(true);

    fireEvent.click(inDeckBox);
    expect(inDeckBox.checked).toBe(false);
  });

  it("calls onApply when the apply button is clicked", () => {
    const onApply = vi.fn();
    renderWithIntl(
      <FiltersPanel draftFilters={draft()} setDraftFilters={vi.fn()} filterOptions={filterOptions} onApply={onApply} />
    );
    fireEvent.click(screen.getByText("Aplicar filtros"));
    expect(onApply).toHaveBeenCalledOnce();
  });
});
