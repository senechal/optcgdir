import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithIntl } from "../test-utils";
import Dashboard from "./Dashboard";
import type { CardWithCollectionInfo, FilterOptions } from "../lib/dashboardTypes";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => "/",
}));

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

const filterOptions: FilterOptions = {
  sets: [{ id: "OP-01", name: "Romance Dawn" }],
  colors: [{ value: "Red", label: "Vermelho" }],
  rarities: ["L"],
  types: ["Leader"],
};

function renderDashboard(overrides: Partial<Parameters<typeof Dashboard>[0]> = {}) {
  return renderWithIntl(
    <Dashboard
      cards={[card()]}
      filterOptions={filterOptions}
      currentParams={{}}
      view="grid"
      tab="all"
      version="1.2.3"
      locale="pt-BR"
      {...overrides}
    />
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  });

  it("shows the title, version badge and card count", () => {
    renderDashboard({ cards: [card(), card({ cardImageId: "OP01-002" })] });
    expect(screen.getByText("OPTCG Collection Manager")).toBeInTheDocument();
    expect(screen.getByText("v1.2.3")).toBeInTheDocument();
    expect(screen.getByText("2 cartas encontradas")).toBeInTheDocument();
  });

  it("shows the empty-state message when there are no cards", () => {
    renderDashboard({ cards: [] });
    expect(screen.getByText("Nenhuma carta encontrada com esses filtros.")).toBeInTheDocument();
  });

  it("renders one CardTile per card in grid view", () => {
    renderDashboard({ cards: [card({ cardImageId: "A" }), card({ cardImageId: "B", cardName: "Hina" })] });
    expect(screen.getByText("Monkey.D.Luffy")).toBeInTheDocument();
    expect(screen.getByText("Hina")).toBeInTheDocument();
  });

  it("renders a table with one CardRow per card in list view", () => {
    const { container } = renderDashboard({ view: "list", cards: [card()] });
    expect(container.querySelector(".card-table")).toBeInTheDocument();
    expect(container.querySelectorAll("tr.card-row")).toHaveLength(1);
  });

  it("groups cards by set with section headers only in the 'grouped' tab", () => {
    const { container } = renderDashboard({
      tab: "grouped",
      cards: [card({ cardImageId: "A", setId: "OP-01" }), card({ cardImageId: "B", setId: "OP-02" })],
    });
    const headers = container.querySelectorAll("h2");
    expect(Array.from(headers).map((h) => h.textContent).sort()).toEqual(["OP-01", "OP-02"]);
  });

  it("does not show group headers in the 'all' tab", () => {
    const { container } = renderDashboard({ tab: "all" });
    expect(container.querySelectorAll("h2")).toHaveLength(0);
  });

  it("submits the search box as a 'search' URL param", () => {
    renderDashboard();
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nome/), { target: { value: "Luffy" } });
    fireEvent.click(screen.getByText("Buscar"));
    expect(push).toHaveBeenCalledWith("/?search=Luffy");
  });

  it("shows a clear-search button only when a search is active, and clears it on click", () => {
    renderDashboard({ currentParams: { search: "Luffy" } });
    fireEvent.click(screen.getByText("Limpar busca"));
    expect(push).toHaveBeenCalledWith("/");
  });

  it("does not show the clear-search button when there's no active search", () => {
    renderDashboard({ currentParams: {} });
    expect(screen.queryByText("Limpar busca")).not.toBeInTheDocument();
  });

  it("pushes a 'sort' URL param when the sort select changes", () => {
    renderDashboard();
    fireEvent.change(screen.getByDisplayValue("Ordenar: código"), { target: { value: "name" } });
    expect(push).toHaveBeenCalledWith("/?sort=name");
  });

  it("pushes a 'view' URL param when switching grid/list", () => {
    renderDashboard({ view: "grid" });
    fireEvent.click(screen.getByText("📋 Lista"));
    expect(push).toHaveBeenCalledWith("/?view=list");
  });

  it("disables the button matching the current view", () => {
    renderDashboard({ view: "grid" });
    expect(screen.getByText("🔳 Grade")).toBeDisabled();
    expect(screen.getByText("📋 Lista")).not.toBeDisabled();
  });

  it("maps the 'all' tab to no tab param, and other tabs to their value", () => {
    renderDashboard({ tab: "grouped" });
    fireEvent.click(screen.getByRole("tab", { name: "Todos" }));
    expect(push).toHaveBeenCalledWith("/");
  });

  it("pushes the selected non-'all' tab as a URL param", () => {
    renderDashboard({ tab: "all" });
    fireEvent.click(screen.getByRole("tab", { name: "Duplicatas" }));
    expect(push).toHaveBeenCalledWith("/?tab=duplicates");
  });

  it("toggles the filters panel open and closed, showing the active-filter badge", () => {
    renderDashboard({ currentParams: { color: "Red", rarity: "L" } });
    expect(screen.getByText("2")).toBeInTheDocument(); // filter-badge
    expect(screen.queryByText("Aplicar filtros")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/Filtros/));
    expect(screen.getByText("Aplicar filtros")).toBeInTheDocument();
  });

  it("removes a filter pill by pushing the URL without that param", () => {
    renderDashboard({ currentParams: { color: "Red" } });
    fireEvent.click(screen.getByLabelText("Remover filtro: Cor: Vermelho"));
    expect(push).toHaveBeenCalledWith("/");
  });

  it("closes the filters panel and applies the draft after clicking 'Aplicar filtros'", () => {
    renderDashboard({ currentParams: {} });
    fireEvent.click(screen.getByText(/Filtros/));
    fireEvent.click(screen.getByText("Aplicar filtros"));
    expect(push).toHaveBeenCalledWith("/");
    expect(screen.queryByText("Aplicar filtros")).not.toBeInTheDocument();
  });

  it("opens the image modal from a card and closes it again", () => {
    renderDashboard({ cards: [card({ localImagePath: "x.png" })] });
    fireEvent.click(screen.getByTitle("Ver imagem maior"));
    expect(screen.getByLabelText("Fechar")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Fechar"));
    expect(screen.queryByLabelText("Fechar")).not.toBeInTheDocument();
  });

  it("posts to /api/collection and refreshes when an icon button mutates a card", async () => {
    renderDashboard({ cards: [card({ cardImageId: "OP01-099" })] });
    fireEvent.click(screen.getByTitle("Adicionar 1"));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/collection", expect.objectContaining({ method: "POST" })));
    expect(JSON.parse((fetch as any).mock.calls[0][1].body)).toEqual({ cardImageId: "OP01-099", action: "increment" });
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it("shows scan candidates to choose from when the top guess isn't a confident code match", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          { cardImageId: "A", cardSetId: "OP12-001", cardName: "Nami", matchedByCode: false, localImagePath: null },
          { cardImageId: "B", cardSetId: "OP12-002", cardName: "Zoro", matchedByCode: false, localImagePath: null },
        ],
      }),
    });
    renderDashboard();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "card.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText("Selecione a carta correta:")).toBeInTheDocument());
    expect(screen.getByText("Nami")).toBeInTheDocument();
    expect(screen.getByText("Zoro")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("applies the search term directly, skipping the picker, when the top guess is a confident code match", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ cardImageId: "A", cardSetId: "OP12-001", cardName: "Nami", matchedByCode: true, localImagePath: null }],
      }),
    });
    renderDashboard();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "card.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(push).toHaveBeenCalledWith("/?search=OP12-001"));
    expect(screen.getByPlaceholderText(/Buscar por nome/)).toHaveValue("OP12-001");
    expect(screen.queryByText("Selecione a carta correta:")).not.toBeInTheDocument();
  });

  it("applies the search term for the candidate the user picks from the scan suggestions", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ cardImageId: "A", cardSetId: "OP12-001", cardName: "Nami (Parallel)", matchedByCode: false, localImagePath: null }],
      }),
    });
    renderDashboard();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "card.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const candidateButton = await screen.findByText("Nami (Parallel)");
    fireEvent.click(candidateButton);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/?search=Nami"));
    expect(screen.getByPlaceholderText(/Buscar por nome/)).toHaveValue("Nami");
    expect(screen.queryByText("Selecione a carta correta:")).not.toBeInTheDocument();
  });

  it("dismisses the scan suggestions without applying any search", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ cardImageId: "A", cardSetId: "OP12-001", cardName: "Nami", matchedByCode: false, localImagePath: null }],
      }),
    });
    renderDashboard();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "card.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await screen.findByText("Selecione a carta correta:");
    fireEvent.click(screen.getByText("Fechar"));

    expect(screen.queryByText("Selecione a carta correta:")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
