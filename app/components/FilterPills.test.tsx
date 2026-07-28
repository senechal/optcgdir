import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "../test-utils";
import FilterPills from "./FilterPills";
import type { FilterOptions } from "../lib/dashboardTypes";

const filterOptions: FilterOptions = {
  sets: [{ id: "OP-01", name: "Romance Dawn" }],
  colors: [{ value: "Red", label: "Vermelho" }],
  rarities: ["L", "SR"],
  types: ["Leader", "Character"],
};

describe("FilterPills", () => {
  it("renders nothing when there are no active filters", () => {
    const { container } = renderWithIntl(
      <FilterPills currentParams={{}} filterOptions={filterOptions} onRemove={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a pill with the translated color label looked up from filterOptions", () => {
    renderWithIntl(<FilterPills currentParams={{ color: "Red" }} filterOptions={filterOptions} onRemove={vi.fn()} />);
    expect(screen.getByText("Cor: Vermelho")).toBeInTheDocument();
  });

  it("falls back to the raw value if the color isn't found in filterOptions", () => {
    renderWithIntl(<FilterPills currentParams={{ color: "Unknown" }} filterOptions={filterOptions} onRemove={vi.fn()} />);
    expect(screen.getByText("Cor: Unknown")).toBeInTheDocument();
  });

  it("shows a pill with the set's name looked up from filterOptions", () => {
    renderWithIntl(<FilterPills currentParams={{ set: "OP-01" }} filterOptions={filterOptions} onRemove={vi.fn()} />);
    expect(screen.getByText("Set: Romance Dawn")).toBeInTheDocument();
  });

  it("falls back to the raw set id if not found in filterOptions", () => {
    renderWithIntl(<FilterPills currentParams={{ set: "ZZ-99" }} filterOptions={filterOptions} onRemove={vi.fn()} />);
    expect(screen.getByText("Set: ZZ-99")).toBeInTheDocument();
  });

  it("renders pills for rarity, type, cost range, power range", () => {
    renderWithIntl(
      <FilterPills
        currentParams={{ rarity: "SR", type: "Character", costMin: "2", costMax: "5", powerMin: "3000", powerMax: "8000" }}
        filterOptions={filterOptions}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText("Raridade: SR")).toBeInTheDocument();
    expect(screen.getByText("Tipo: Character")).toBeInTheDocument();
    expect(screen.getByText("Custo ≥ 2")).toBeInTheDocument();
    expect(screen.getByText("Custo ≤ 5")).toBeInTheDocument();
    expect(screen.getByText("Poder ≥ 3000")).toBeInTheDocument();
    expect(screen.getByText("Poder ≤ 8000")).toBeInTheDocument();
  });

  it("only shows the boolean-flag pills when their value is exactly '1'", () => {
    renderWithIntl(
      <FilterPills currentParams={{ inDeck: "0", counter: "1" }} filterOptions={filterOptions} onRemove={vi.fn()} />
    );
    expect(screen.queryByText("Só em algum deck")).not.toBeInTheDocument();
    expect(screen.getByText("Só com counter")).toBeInTheDocument();
  });

  it("calls onRemove with the pill's key when its remove button is clicked", () => {
    const onRemove = vi.fn();
    renderWithIntl(<FilterPills currentParams={{ color: "Red" }} filterOptions={filterOptions} onRemove={onRemove} />);
    fireEvent.click(screen.getByLabelText("Remover filtro: Cor: Vermelho"));
    expect(onRemove).toHaveBeenCalledWith("color");
  });
});
