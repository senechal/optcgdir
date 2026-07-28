"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import LocaleSwitcher from "./LocaleSwitcher";
import TabsBar from "./TabsBar";
import FilterPills from "./FilterPills";
import FiltersPanel from "./FiltersPanel";
import ScanButton from "./ScanButton";
import ScanCandidatesList from "./ScanCandidatesList";
import CardTile from "./CardTile";
import CardRow from "./CardRow";
import CardImageModal from "./CardImageModal";
import type { Locale } from "../i18n/request";
import { stripVariantSuffix } from "../lib/cardDisplay";
import type { CardWithCollectionInfo, FilterOptions, DraftFilters, Tab, ScanCandidate } from "../lib/dashboardTypes";

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
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [scanCandidates, setScanCandidates] = useState<ScanCandidate[]>([]);
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

  function handleScanResult(term: string) {
    setSearchInput(term);
    updateParam("search", term);
  }

  function handleScanDirectApply(term: string) {
    // Aplica direto (código lido com confiança) — limpa qualquer lista de
    // candidatos ainda visível de um scan anterior, senão ela ficaria presa
    // na tela sobre o resultado novo.
    handleScanResult(term);
    setScanCandidates([]);
  }

  function handleSelectScanCandidate(candidate: ScanCandidate) {
    const term = candidate.matchedByCode ? candidate.cardSetId : stripVariantSuffix(candidate.cardName);
    handleScanResult(term);
    setScanCandidates([]);
    setScanNotice(null);
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
        <TabsBar activeTab={tab} onSelectTab={(tabValue) => updateParam("tab", tabValue === "all" ? null : tabValue)} />
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
          <ScanButton
            onSearchTermReady={handleScanDirectApply}
            onCandidates={setScanCandidates}
            onNotice={setScanNotice}
            onError={(message) => {
              setScanError(message);
              setScanCandidates([]);
            }}
          />
        </form>
        {scanNotice && <p style={{ fontSize: 13, color: "var(--color-success)", marginTop: 4, marginBottom: 0 }}>{scanNotice}</p>}
        {scanError && <p style={{ fontSize: 13, color: "var(--color-danger)", marginTop: 4, marginBottom: 0 }}>{scanError}</p>}
        {scanCandidates.length > 0 && (
          <ScanCandidatesList
            candidates={scanCandidates}
            onSelect={handleSelectScanCandidate}
            onDismiss={() => {
              setScanCandidates([]);
              setScanNotice(null);
            }}
          />
        )}

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

        <FilterPills currentParams={currentParams} filterOptions={filterOptions} onRemove={(key) => updateParam(key, null)} />
      </div>

      {filtersOpen && (
        <FiltersPanel
          draftFilters={draftFilters}
          setDraftFilters={setDraftFilters}
          filterOptions={filterOptions}
          onApply={applyDraftFilters}
        />
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

        .search-row {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          margin-bottom: var(--space-1);
        }
        .search-input {
          flex: 1 1 240px;
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
