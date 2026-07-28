"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useTransition, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import LocaleSwitcher from "./LocaleSwitcher";
import CardTile from "./CardTile";
import CardRow from "./CardRow";
import CardImageModal from "./CardImageModal";
import { stripVariantSuffix } from "../lib/cardDisplay";
import type { Locale } from "../i18n/request";
import type {
  CardWithCollectionInfo,
  FilterOptions,
  DraftFilters,
  Tab,
  ScanCandidate,
} from "../lib/dashboardTypes";

export default function Dashboard({
  cards,
  filterOptions,
  currentParams,
  view,
  tab,
  version,
  locale,
}: {
  cards: CardWithCollectionInfo[];
  filterOptions: FilterOptions;
  currentParams: Record<string, string>;
  view: "grid" | "list";
  tab: Tab;
  version: string;
  locale: Locale;
}) {
  // A aba "grouped" é só um modo de exibição do catálogo inteiro — não
  // filtra por posse, ao contrário de "owned"/"duplicates"/"wantsTrade".
  const groupBySet = tab === "grouped";
  const t = useTranslations("Dashboard");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(currentParams.search || "");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [enlargedCard, setEnlargedCard] = useState<CardWithCollectionInfo | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Contagem de filtros ativos pro badge do botão "Filtros" — assim dá pra
  // saber que tem filtro aplicado sem precisar abrir o painel colapsado.
  const activeFilterCount = [
    currentParams.color,
    currentParams.rarity,
    currentParams.type,
    currentParams.set,
    currentParams.costMin,
    currentParams.costMax,
    currentParams.powerMin,
    currentParams.powerMax,
    currentParams.inDeck,
    currentParams.counter,
  ].filter(Boolean).length;

  function updateParams(patch: Record<string, string | null>) {
    const next: Record<string, string> = { ...currentParams };
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") {
        delete next[key];
      } else {
        next[key] = value;
      }
    }
    const qs = new URLSearchParams(next).toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function updateParam(key: string, value: string | null) {
    updateParams({ [key]: value });
  }

  // Filtros do painel colapsável não aplicam na hora — ficam num rascunho
  // local até o usuário clicar em "Aplicar filtros". Cor/ordenação/busca/
  // agrupar continuam instantâneos (não são "filtros" que estreitam a
  // lista, ou já têm sua própria ação de confirmar, como a busca).
  function buildDraftFilters(params: Record<string, string>): DraftFilters {
    return {
      color: params.color || "",
      rarity: params.rarity || "",
      type: params.type || "",
      set: params.set || "",
      costMin: params.costMin || "",
      costMax: params.costMax || "",
      powerMin: params.powerMin || "",
      powerMax: params.powerMax || "",
      inDeck: params.inDeck === "1",
      counter: params.counter === "1",
    };
  }

  const [draftFilters, setDraftFilters] = useState<DraftFilters>(() => buildDraftFilters(currentParams));

  // Ressincroniza o rascunho sempre que os filtros de verdade (URL) mudam —
  // seja porque o usuário clicou em "Aplicar", removeu um pill, ou navegou
  // de outra forma. Sem isso, reabrir o painel depois de fechar sem aplicar
  // mostraria uma edição abandonada em vez do que está realmente ativo.
  useEffect(() => {
    setDraftFilters(buildDraftFilters(currentParams));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentParams.color,
    currentParams.rarity,
    currentParams.type,
    currentParams.set,
    currentParams.costMin,
    currentParams.costMax,
    currentParams.powerMin,
    currentParams.powerMax,
    currentParams.inDeck,
    currentParams.counter,
  ]);

  function applyDraftFilters() {
    updateParams({
      color: draftFilters.color || null,
      rarity: draftFilters.rarity || null,
      type: draftFilters.type || null,
      set: draftFilters.set || null,
      costMin: draftFilters.costMin || null,
      costMax: draftFilters.costMax || null,
      powerMin: draftFilters.powerMin || null,
      powerMax: draftFilters.powerMax || null,
      inDeck: draftFilters.inDeck ? "1" : null,
      counter: draftFilters.counter ? "1" : null,
    });
    setFiltersOpen(false);
  }

  // Pills dos filtros REALMENTE aplicados (vêm da URL, não do rascunho) —
  // cada um removível na hora, sem precisar abrir o painel nem clicar em
  // "Aplicar".
  const filterPills: { key: string; text: string }[] = [];
  if (currentParams.color) {
    const label = filterOptions.colors.find((c) => c.value === currentParams.color)?.label ?? currentParams.color;
    filterPills.push({ key: "color", text: `${t("colColor")}: ${label}` });
  }
  if (currentParams.rarity) {
    filterPills.push({ key: "rarity", text: `${t("colRarity")}: ${currentParams.rarity}` });
  }
  if (currentParams.type) {
    filterPills.push({ key: "type", text: `${t("colType")}: ${currentParams.type}` });
  }
  if (currentParams.set) {
    const label = filterOptions.sets.find((s) => s.id === currentParams.set)?.name ?? currentParams.set;
    filterPills.push({ key: "set", text: `${t("colSet")}: ${label}` });
  }
  if (currentParams.costMin) filterPills.push({ key: "costMin", text: `${t("colCost")} ≥ ${currentParams.costMin}` });
  if (currentParams.costMax) filterPills.push({ key: "costMax", text: `${t("colCost")} ≤ ${currentParams.costMax}` });
  if (currentParams.powerMin) filterPills.push({ key: "powerMin", text: `${t("colPower")} ≥ ${currentParams.powerMin}` });
  if (currentParams.powerMax) filterPills.push({ key: "powerMax", text: `${t("colPower")} ≤ ${currentParams.powerMax}` });
  if (currentParams.inDeck === "1") filterPills.push({ key: "inDeck", text: t("onlyInDeck") });
  if (currentParams.counter === "1") filterPills.push({ key: "counter", text: t("onlyCounter") });

  async function handleScanFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escanear a mesma foto de novo em seguida

    if (!file) return;

    setScanError(null);
    setScanNotice(null);
    setScanning(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/scan", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setScanError(data.error || t("scanErrorGeneric"));
        return;
      }

      const candidates: ScanCandidate[] = data.candidates ?? [];
      const top = candidates[0];
      if (!top) {
        setScanError(t("scanErrorNoCandidates"));
        return;
      }

      // Código impresso é o sinal mais confiável (busca 1 carta específica);
      // se o OCR não achou um código com confiança, cai pro nome — mais
      // abrangente, mas evita filtrar pela carta errada por causa de um
      // código mal lido.
      if (top.matchedByCode) {
        setSearchInput(top.cardSetId);
        updateParam("search", top.cardSetId);
        setScanNotice(t("scanNoticeByCode", { name: top.cardName, code: top.cardSetId }));
      } else {
        const searchTerm = stripVariantSuffix(top.cardName);
        setSearchInput(searchTerm);
        updateParam("search", searchTerm);
        setScanNotice(t("scanNoticeByName", { term: searchTerm }));
      }
    } catch {
      setScanError(t("scanErrorUpload"));
    } finally {
      setScanning(false);
    }
  }

  async function mutateCollection(cardImageId: string, action: string) {
    await fetch("/api/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardImageId, action }),
    });
    router.refresh();
  }

  const groupedEntries: [string, CardWithCollectionInfo[]][] = groupBySet
    ? Object.entries(
        cards.reduce<Record<string, CardWithCollectionInfo[]>>((acc, c) => {
          (acc[c.setId] ||= []).push(c);
          return acc;
        }, {})
      ).sort(([a], [b]) => a.localeCompare(b))
    : [[t("allCardsGroup"), cards]];

  return (
    <div className="dashboard-container">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <h1 style={{ marginBottom: 4 }}>{t("title")}</h1>
          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>v{version}</span>
        </div>
        <LocaleSwitcher current={locale} />
      </div>
      <p style={{ color: "var(--color-text-secondary)", marginTop: 0, marginBottom: 20 }}>
        {t("cardsFound", { count: cards.length })} {isPending && t("updating")}
      </p>

      <div className="sticky-controls">
        <div className="tabs-row" role="tablist">
          {(["all", "grouped", "owned", "duplicates", "wantsTrade"] as Tab[]).map((tabValue) => (
            <button
              key={tabValue}
              type="button"
              role="tab"
              aria-selected={tab === tabValue}
              className={tab === tabValue ? "tab-button tab-button-active" : "tab-button"}
              onClick={() => updateParam("tab", tabValue === "all" ? null : tabValue)}
            >
              {t(`tab_${tabValue}`)}
            </button>
          ))}
        </div>
        <form
          className="search-row"
          onSubmit={(e) => {
            e.preventDefault();
            updateParam("search", searchInput || null);
          }}
        >
          <input
            className="search-input"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("searchPlaceholder")}
          />
          <button type="submit">{t("searchButton")}</button>
          {currentParams.search && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                updateParam("search", null);
              }}
            >
              {t("clearSearch")}
            </button>
          )}
          <label
            className="scan-label"
            style={{
              cursor: scanning ? "default" : "pointer",
              opacity: scanning ? 0.6 : 1,
            }}
          >
            📷 {scanning ? t("scanToSearchIdentifying") : t("scanToSearchLabel")}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleScanFile}
              disabled={scanning}
              style={{ display: "none" }}
            />
          </label>
        </form>
        {scanNotice && <p style={{ fontSize: 13, color: "var(--color-success)", marginTop: 4, marginBottom: 0 }}>{scanNotice}</p>}
        {scanError && <p style={{ fontSize: 13, color: "var(--color-danger)", marginTop: 4, marginBottom: 0 }}>{scanError}</p>}

        <div className="toolbar-row">
          <select
            value={currentParams.sort || "code"}
            onChange={(e) => updateParam("sort", e.target.value)}
          >
            <option value="code">{t("sortCode")}</option>
            <option value="name">{t("sortName")}</option>
            <option value="cost">{t("sortCost")}</option>
            <option value="power">{t("sortPower")}</option>
            <option value="rarity">{t("sortRarity")}</option>
            <option value="set">{t("sortSet")}</option>
            <option value="dateAdded">{t("sortDateAdded")}</option>
          </select>

          <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
            {t("filtersToggle")}
            {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
            {filtersOpen ? " ▲" : " ▼"}
          </button>

          <div className="view-toggle">
            <button onClick={() => updateParam("view", "grid")} disabled={view === "grid"}>
              {t("viewGrid")}
            </button>
            <button onClick={() => updateParam("view", "list")} disabled={view === "list"}>
              {t("viewList")}
            </button>
          </div>
        </div>

        {filterPills.length > 0 && (
          <div className="filter-pills">
            {filterPills.map((pill) => (
              <span key={pill.key} className="filter-pill">
                {pill.text}
                <button
                  type="button"
                  className="filter-pill-remove"
                  onClick={() => updateParam(pill.key, null)}
                  aria-label={t("removeFilter", { filter: pill.text })}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {filtersOpen && (
        <div className="filters-panel">
          <div className="filters-grid">
            <select
              value={draftFilters.color}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, color: e.target.value }))}
            >
              <option value="">{t("filterColorAll")}</option>
              {filterOptions.colors.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <select
              value={draftFilters.rarity}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, rarity: e.target.value }))}
            >
              <option value="">{t("filterRarityAll")}</option>
              {filterOptions.rarities.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <select
              value={draftFilters.type}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, type: e.target.value }))}
            >
              <option value="">{t("filterTypeAll")}</option>
              {filterOptions.types.map((typeOption) => (
                <option key={typeOption} value={typeOption}>
                  {typeOption}
                </option>
              ))}
            </select>

            <select
              value={draftFilters.set}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, set: e.target.value }))}
            >
              <option value="">{t("filterSetAll")}</option>
              {filterOptions.sets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder={t("costMinPlaceholder")}
              value={draftFilters.costMin}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, costMin: e.target.value }))}
            />
            <input
              type="number"
              placeholder={t("costMaxPlaceholder")}
              value={draftFilters.costMax}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, costMax: e.target.value }))}
            />
            <input
              type="number"
              placeholder={t("powerMinPlaceholder")}
              value={draftFilters.powerMin}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, powerMin: e.target.value }))}
            />
            <input
              type="number"
              placeholder={t("powerMaxPlaceholder")}
              value={draftFilters.powerMax}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, powerMax: e.target.value }))}
            />
          </div>

          <div className="filters-checkboxes">
            <label>
              <input
                type="checkbox"
                checked={draftFilters.inDeck}
                onChange={() => setDraftFilters((prev) => ({ ...prev, inDeck: !prev.inDeck }))}
              />{" "}
              {t("onlyInDeck")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={draftFilters.counter}
                onChange={() => setDraftFilters((prev) => ({ ...prev, counter: !prev.counter }))}
              />{" "}
              {t("onlyCounter")}
            </label>
          </div>

          <div className="filters-apply-row">
            <button type="button" className="filters-apply-button" onClick={applyDraftFilters}>
              {t("applyFilters")}
            </button>
          </div>
        </div>
      )}

      {groupedEntries.map(([groupName, groupCards]) => (
        <section key={groupName} style={{ marginBottom: 32 }}>
          {groupBySet && (
            <h2 style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 4 }}>{groupName}</h2>
          )}

          {groupCards.length === 0 ? (
            <p
              style={{
                color: "var(--color-text-secondary)",
                textAlign: "center",
                padding: "var(--space-8) var(--space-4)",
                border: "1px dashed var(--color-border-strong)",
                borderRadius: "var(--radius-lg)",
              }}
            >
              {t("noCardsFound")}
            </p>
          ) : view === "grid" ? (
            <div className="card-grid">
              {groupCards.map((card) => (
                <CardTile
                  key={card.cardImageId}
                  card={card}
                  onMutate={mutateCollection}
                  onEnlarge={setEnlargedCard}
                />
              ))}
            </div>
          ) : (
            <table className="card-table">
              <thead>
                <tr>
                  <th className="col-image"></th>
                  <th className="col-name">{t("colName")}</th>
                  <th className="col-code">{t("colCode")}</th>
                  <th className="col-color hide-mobile">{t("colColor")}</th>
                  <th className="col-type hide-mobile">{t("colType")}</th>
                  <th className="col-rarity hide-mobile">{t("colRarity")}</th>
                  <th className="col-cost hide-mobile">{t("colCost")}</th>
                  <th className="col-power hide-mobile">{t("colPower")}</th>
                  <th className="col-qty hide-mobile">{t("colQty")}</th>
                  <th className="col-indeck hide-mobile">{t("colInDeck")}</th>
                  <th className="col-actions">{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {groupCards.map((card) => (
                  <CardRow key={card.cardImageId} card={card} onMutate={mutateCollection} onEnlarge={setEnlargedCard} />
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}

      {enlargedCard && <CardImageModal card={enlargedCard} onClose={() => setEnlargedCard(null)} />}

      <style jsx>{`
        .dashboard-container {
          font-family: var(--font-sans);
          padding: var(--space-4);
          max-width: 1400px;
          margin: 0 auto;
        }
        @media (min-width: 900px) {
          .dashboard-container {
            padding: var(--space-6) var(--space-8);
          }
        }

        .sticky-controls {
          position: sticky;
          top: 0;
          z-index: 10;
          margin: 0 calc(var(--space-4) * -1) var(--space-4);
          padding: var(--space-2) var(--space-4) var(--space-3);
          background: var(--color-bg-subtle);
          border-bottom: 1px solid var(--color-border);
        }
        @media (min-width: 900px) {
          .sticky-controls {
            margin: 0 calc(var(--space-8) * -1) var(--space-4);
            padding: var(--space-2) var(--space-8) var(--space-3);
          }
        }

        .tabs-row {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-1);
          margin-bottom: var(--space-2);
        }
        .tab-button {
          background: transparent;
          border-color: transparent;
        }
        .tab-button-active {
          background: var(--color-accent-subtle);
          border-color: var(--color-accent);
          color: var(--color-accent);
          font-weight: 600;
        }

        .search-row {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          margin-bottom: var(--space-1);
        }
        .search-input {
          flex: 1 1 240px;
        }

        .scan-label {
          display: inline-flex;
          align-items: center;
          min-height: var(--touch-target);
          padding: 0 var(--space-4);
          border: 1px solid var(--color-border-strong);
          border-radius: var(--radius-md);
          background: var(--color-surface);
          font-size: var(--font-size-base);
          white-space: nowrap;
        }

        .toolbar-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-3);
        }
        .toolbar-row select {
          flex: 1 1 160px;
        }
        .view-toggle {
          display: flex;
          gap: var(--space-2);
          margin-left: auto;
        }

        .filter-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          margin-left: var(--space-2);
          border-radius: var(--radius-full);
          background: var(--color-accent);
          color: #fff;
          font-size: var(--font-size-xs);
          font-weight: 600;
        }

        .filters-panel {
          padding: var(--space-4);
          margin-bottom: var(--space-4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          background: var(--color-surface);
        }
        .filters-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }
        .filters-checkboxes {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2) var(--space-5);
          font-size: var(--font-size-sm);
        }

        .filters-apply-row {
          display: flex;
          justify-content: flex-end;
          margin-top: var(--space-4);
        }
        .filters-apply-button {
          background: var(--color-accent);
          border-color: var(--color-accent);
          color: #fff;
          font-weight: 600;
        }
        .filters-apply-button:hover {
          background: var(--color-accent-hover);
          border-color: var(--color-accent-hover);
        }

        .filter-pills {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          margin-top: var(--space-2);
        }
        .filter-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 4px 4px 10px;
          border-radius: var(--radius-full);
          background: var(--color-accent-subtle);
          color: var(--color-accent-hover);
          font-size: var(--font-size-xs);
          font-weight: 500;
        }
        .filter-pill-remove {
          all: unset;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          min-height: 18px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 11px;
          color: var(--color-accent-hover);
        }
        .filter-pill-remove:hover {
          background: rgba(0, 0, 0, 0.08);
        }

        .card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: var(--space-3);
        }

      `}</style>

      {/* global: CardRow/CardTile são componentes separados, então um
          <style jsx> escopado aqui não alcançaria as <tr>/<td> que eles
          renderizam (o styled-jsx só marca elementos do PRÓPRIO componente
          que declara o bloco). */}
      <style jsx global>{`
        .card-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--font-size-sm);
        }
        .card-table thead tr {
          text-align: left;
          border-bottom: 2px solid var(--color-border);
        }
        .card-table th,
        .card-table td {
          padding: var(--space-2);
        }
        .card-table tbody tr {
          border-bottom: 1px solid var(--color-border);
        }
        .card-table .col-image {
          width: 50px;
        }
        .card-table .row-thumb {
          width: 40px;
          flex-shrink: 0;
        }
        .card-table .row-meta {
          display: none;
        }

        /* Abaixo de ~700px, a tabela vira uma lista de linhas compactas
           (miniatura + nome/código + qtd), sem tabela/scroll horizontal —
           colunas menos essenciais (cor, tipo, raridade, custo, poder, em
           deck) somem, mas o código continua visível dentro da própria
           célula do nome via .row-meta. */
        @media (max-width: 699px) {
          .card-table thead {
            display: none;
          }
          .card-table,
          .card-table tbody,
          .card-table tr {
            display: block;
            width: 100%;
          }
          .card-table tr.card-row {
            display: flex;
            align-items: center;
            gap: var(--space-3);
            padding: var(--space-2) 0;
          }
          .card-table td {
            padding: 0;
          }
          .card-table td.hide-mobile,
          .card-table td.col-code {
            display: none;
          }
          .card-table td.col-image {
            flex: 0 0 auto;
          }
          .card-table td.col-name {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
          }
          .card-table td.col-name a {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .card-table .row-meta {
            display: block;
            font-size: var(--font-size-xs);
            color: var(--color-text-secondary);
          }
          .card-table td.col-actions {
            display: flex;
            flex: 0 0 auto;
            gap: 4px;
          }
        }
      `}</style>
    </div>
  );
}
