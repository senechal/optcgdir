"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useTransition, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import CardImage from "./CardImage";
import LocaleSwitcher from "./LocaleSwitcher";
import type { Locale } from "../i18n/request";

type ScanCandidate = {
  cardImageId: string;
  cardSetId: string;
  cardName: string;
  matchedByCode: boolean;
};

export type CardWithCollectionInfo = {
  cardImageId: string;
  cardSetId: string;
  cardName: string;
  cardColor: string | null;
  cardType: string;
  rarity: string | null;
  cardCost: string | null;
  cardPower: string | null;
  counterAmount: string | null;
  setId: string;
  localImagePath: string | null;
  isParallel: boolean;
  sourceType: string;
  quantity: number;
  wantsTrade: boolean;
  allocatedInDecks: number;
};

type FilterOptions = {
  sets: { id: string; name: string }[];
  colors: { value: string; label: string }[];
  rarities: string[];
  types: string[];
};

// O card_name da optcgapi já vem com sufixos como "(Parallel)" ou
// "(Alternative Art)" — removemos porque a variante já é representada
// separadamente (V.1/V.2/Promo no link do Cardmarket, ou porque buscar
// pelo nome-base traz todas as variantes daquela carta).
function stripVariantSuffix(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "");
}

function cardmarketUrl(card: CardWithCollectionInfo) {
  const baseName = stripVariantSuffix(card.cardName);
  const variant = card.sourceType === "promo" ? "Promo" : card.isParallel ? "V.2" : "V.1";
  const searchString = `${baseName} ${card.cardSetId} ${variant}`;
  return `https://www.cardmarket.com/en/OnePiece/Products/Search?searchString=${encodeURIComponent(
    searchString
  )}`;
}

export default function Dashboard({
  cards,
  filterOptions,
  currentParams,
  view,
  groupBySet,
  version,
  locale,
}: {
  cards: CardWithCollectionInfo[];
  filterOptions: FilterOptions;
  currentParams: Record<string, string>;
  view: "grid" | "list";
  groupBySet: boolean;
  version: string;
  locale: Locale;
}) {
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
    currentParams.owned,
    currentParams.duplicates,
    currentParams.wantsTrade,
    currentParams.inDeck,
    currentParams.counter,
  ].filter(Boolean).length;

  function updateParam(key: string, value: string | null) {
    const next: Record<string, string> = { ...currentParams };
    if (value === null || value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }
    const qs = new URLSearchParams(next).toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function toggleParam(key: string) {
    updateParam(key, currentParams[key] === "1" ? null : "1");
  }

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
          <span style={{ fontSize: 12, color: "#999" }}>v{version}</span>
        </div>
        <LocaleSwitcher current={locale} />
      </div>
      <p style={{ color: "#888", marginTop: 0, marginBottom: 20 }}>
        {t("cardsFound", { count: cards.length })} {isPending && t("updating")}
      </p>

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
      {scanNotice && <p style={{ fontSize: 13, color: "var(--color-success)", marginTop: 4, marginBottom: 16 }}>{scanNotice}</p>}
      {scanError && <p style={{ fontSize: 13, color: "var(--color-danger)", marginTop: 4, marginBottom: 16 }}>{scanError}</p>}
      {!scanNotice && !scanError && <div style={{ marginBottom: 16 }} />}

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

      {filtersOpen && (
        <div className="filters-panel">
          <div className="filters-grid">
            <select
              value={currentParams.color || ""}
              onChange={(e) => updateParam("color", e.target.value || null)}
            >
              <option value="">{t("filterColorAll")}</option>
              {filterOptions.colors.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <select
              value={currentParams.rarity || ""}
              onChange={(e) => updateParam("rarity", e.target.value || null)}
            >
              <option value="">{t("filterRarityAll")}</option>
              {filterOptions.rarities.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <select
              value={currentParams.type || ""}
              onChange={(e) => updateParam("type", e.target.value || null)}
            >
              <option value="">{t("filterTypeAll")}</option>
              {filterOptions.types.map((typeOption) => (
                <option key={typeOption} value={typeOption}>
                  {typeOption}
                </option>
              ))}
            </select>

            <select
              value={currentParams.set || ""}
              onChange={(e) => updateParam("set", e.target.value || null)}
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
              value={currentParams.costMin || ""}
              onChange={(e) => updateParam("costMin", e.target.value || null)}
            />
            <input
              type="number"
              placeholder={t("costMaxPlaceholder")}
              value={currentParams.costMax || ""}
              onChange={(e) => updateParam("costMax", e.target.value || null)}
            />
            <input
              type="number"
              placeholder={t("powerMinPlaceholder")}
              value={currentParams.powerMin || ""}
              onChange={(e) => updateParam("powerMin", e.target.value || null)}
            />
            <input
              type="number"
              placeholder={t("powerMaxPlaceholder")}
              value={currentParams.powerMax || ""}
              onChange={(e) => updateParam("powerMax", e.target.value || null)}
            />
          </div>

          <div className="filters-checkboxes">
            <label>
              <input
                type="checkbox"
                checked={currentParams.owned === "1"}
                onChange={() => toggleParam("owned")}
              />{" "}
              {t("onlyOwned")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={currentParams.duplicates === "1"}
                onChange={() => toggleParam("duplicates")}
              />{" "}
              {t("onlyDuplicates")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={currentParams.wantsTrade === "1"}
                onChange={() => toggleParam("wantsTrade")}
              />{" "}
              {t("onlyWantsTrade")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={currentParams.inDeck === "1"}
                onChange={() => toggleParam("inDeck")}
              />{" "}
              {t("onlyInDeck")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={currentParams.counter === "1"}
                onChange={() => toggleParam("counter")}
              />{" "}
              {t("onlyCounter")}
            </label>
            <label>
              <input type="checkbox" checked={groupBySet} onChange={() => toggleParam("groupBySet")} />{" "}
              {t("groupBySet")}
            </label>
          </div>
        </div>
      )}

      {groupedEntries.map(([groupName, groupCards]) => (
        <section key={groupName} style={{ marginBottom: 32 }}>
          {groupBySet && (
            <h2 style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 4 }}>{groupName}</h2>
          )}

          {groupCards.length === 0 ? (
            <p style={{ color: "var(--color-text-secondary)" }}>{t("noCardsFound")}</p>
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

function CardTile({
  card,
  onMutate,
  onEnlarge,
}: {
  card: CardWithCollectionInfo;
  onMutate: (id: string, action: string) => void;
  onEnlarge: (card: CardWithCollectionInfo) => void;
}) {
  const t = useTranslations("Dashboard");

  return (
    <div className="card-tile">
      {card.localImagePath ? (
        <button
          type="button"
          onClick={() => onEnlarge(card)}
          title={t("viewLargerImage")}
          style={{
            all: "unset",
            display: "block",
            width: "100%",
            cursor: "pointer",
          }}
        >
          <CardImage src={`/api/catalog-image/${card.localImagePath}`} alt={card.cardName} />
        </button>
      ) : (
        <div style={{ aspectRatio: "63 / 88", background: "var(--color-bg-subtle)", borderRadius: "var(--radius-sm)" }} />
      )}
      <div style={{ fontSize: 12, marginTop: 8, fontWeight: 600 }}>{card.cardName}</div>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{card.cardSetId}</div>

      <div style={{ fontSize: 11, minHeight: 14, marginTop: 2, color: "var(--color-text-secondary)" }}>
        {card.quantity > 0 && (
          <span>
            {t("quantityLabel", { count: card.quantity })}
            {card.quantity > 1 && t("duplicateSuffixFull")}
          </span>
        )}
      </div>
      {card.allocatedInDecks > 0 && (
        <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
          {t("inDeckCount", { count: card.allocatedInDecks })}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 8 }}>
        <button onClick={() => onMutate(card.cardImageId, "decrement")} title={t("removeOne")}>
          −
        </button>
        <button onClick={() => onMutate(card.cardImageId, "increment")} title={t("addOne")}>
          +
        </button>
        <button
          onClick={() => onMutate(card.cardImageId, "toggleWantsTrade")}
          title={t("wantsTrade")}
          style={{ opacity: card.wantsTrade ? 1 : 0.35 }}
        >
          🔁
        </button>
      </div>
      <a
        href={cardmarketUrl(card)}
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: 11, display: "block", marginTop: 8 }}
      >
        {t("viewOnCardmarket")}
      </a>

      <style jsx>{`
        .card-tile {
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-surface);
          box-shadow: var(--shadow-sm);
          padding: var(--space-2);
          text-align: center;
          transition: box-shadow 0.15s ease, transform 0.15s ease;
        }
        @media (hover: hover) {
          .card-tile:hover {
            box-shadow: var(--shadow-md);
            transform: translateY(-2px);
          }
        }
      `}</style>
    </div>
  );
}

function CardRow({
  card,
  onMutate,
  onEnlarge,
}: {
  card: CardWithCollectionInfo;
  onMutate: (id: string, action: string) => void;
  onEnlarge: (card: CardWithCollectionInfo) => void;
}) {
  const t = useTranslations("Dashboard");

  return (
    <tr className="card-row">
      <td className="col-image">
        {card.localImagePath ? (
          <button
            type="button"
            onClick={() => onEnlarge(card)}
            title={t("viewLargerImage")}
            style={{ all: "unset", display: "block", cursor: "pointer" }}
          >
            <div className="row-thumb">
              <CardImage src={`/api/catalog-image/${card.localImagePath}`} alt={card.cardName} />
            </div>
          </button>
        ) : (
          <div className="row-thumb" style={{ background: "var(--color-bg-subtle)", borderRadius: "var(--radius-sm)" }} />
        )}
      </td>
      <td className="col-name">
        <a href={cardmarketUrl(card)} target="_blank" rel="noreferrer">
          {card.cardName}
        </a>
        <span className="row-meta">
          {card.cardSetId}
          {card.quantity > 0 && ` · ${t("quantityLabel", { count: card.quantity })}`}
        </span>
      </td>
      <td className="col-code">{card.cardSetId}</td>
      <td className="col-color hide-mobile">{card.cardColor}</td>
      <td className="col-type hide-mobile">{card.cardType}</td>
      <td className="col-rarity hide-mobile">{card.rarity}</td>
      <td className="col-cost hide-mobile">{card.cardCost ?? "-"}</td>
      <td className="col-power hide-mobile">{card.cardPower ?? "-"}</td>
      <td className="col-qty hide-mobile">
        {card.quantity}
        {card.quantity > 1 ? t("duplicateSuffixShort") : ""}
      </td>
      <td className="col-indeck hide-mobile">{card.allocatedInDecks > 0 ? card.allocatedInDecks : "-"}</td>
      <td className="col-actions">
        <button onClick={() => onMutate(card.cardImageId, "decrement")} title={t("removeOne")}>
          −
        </button>
        <button onClick={() => onMutate(card.cardImageId, "increment")} title={t("addOne")}>
          +
        </button>
        <button
          onClick={() => onMutate(card.cardImageId, "toggleWantsTrade")}
          title={t("wantsTrade")}
          style={{ opacity: card.wantsTrade ? 1 : 0.35 }}
        >
          🔁
        </button>
      </td>
    </tr>
  );
}

// Modal centralizado em telas largas, drawer colado na base em telas
// estreitas (mesmo componente — só muda via media query no CSS, sem
// precisar detectar o device em JS).
function CardImageModal({
  card,
  onClose,
}: {
  card: CardWithCollectionInfo;
  onClose: () => void;
}) {
  const tCommon = useTranslations("Common");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="card-modal-backdrop" onClick={onClose}>
      <div className="card-modal-panel" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label={tCommon("close")}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 1,
            border: "none",
            background: "rgba(0,0,0,0.06)",
            borderRadius: "50%",
            width: 28,
            height: 28,
            fontSize: 16,
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
        {card.localImagePath ? (
          <CardImage
            src={`/api/catalog-image/${card.localImagePath}`}
            alt={card.cardName}
            objectFit="contain"
            sizes="(max-width: 600px) 100vw, 420px"
          />
        ) : (
          <div style={{ aspectRatio: "63 / 88", background: "#eee", borderRadius: 8 }} />
        )}
        <div style={{ marginTop: 10, fontWeight: 600 }}>{card.cardName}</div>
        <div style={{ fontSize: 12, color: "#888" }}>{card.cardSetId}</div>
      </div>

      <style jsx>{`
        .card-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .card-modal-panel {
          position: relative;
          background: #fff;
          border-radius: 12px;
          padding: 16px;
          width: 100%;
          max-width: 420px;
          max-height: 90vh;
          overflow-y: auto;
          text-align: center;
        }
        @media (max-width: 600px) {
          .card-modal-backdrop {
            align-items: flex-end;
            padding: 0;
          }
          .card-modal-panel {
            max-width: 100%;
            max-height: 85vh;
            border-radius: 16px 16px 0 0;
          }
        }
      `}</style>
    </div>
  );
}
