"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useTransition, type ChangeEvent } from "react";
import Image from "next/image";
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
    <div style={{ fontFamily: "sans-serif", padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <h1 style={{ marginBottom: 4 }}>{t("title")}</h1>
          <span style={{ fontSize: 12, color: "#999" }}>v{version}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LocaleSwitcher current={locale} />
          <a href="/scan" style={{ fontSize: 13, whiteSpace: "nowrap" }}>
            {t("scanAndAddLink")}
          </a>
        </div>
      </div>
      <p style={{ color: "#888", marginTop: 0, marginBottom: 20 }}>
        {t("cardsFound", { count: cards.length })} {isPending && t("updating")}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParam("search", searchInput || null);
        }}
        style={{ marginBottom: 4 }}
      >
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("searchPlaceholder")}
          style={{ padding: 8, width: 380, marginRight: 8 }}
        />
        <button type="submit">{t("searchButton")}</button>
        {currentParams.search && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              updateParam("search", null);
            }}
            style={{ marginLeft: 8 }}
          >
            {t("clearSearch")}
          </button>
        )}
        <label
          style={{
            display: "inline-block",
            padding: "7px 12px",
            marginLeft: 8,
            border: "1px solid #ccc",
            borderRadius: 4,
            cursor: scanning ? "default" : "pointer",
            fontSize: 14,
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
      {scanNotice && <p style={{ fontSize: 13, color: "#080", marginTop: 4, marginBottom: 16 }}>{scanNotice}</p>}
      {scanError && <p style={{ fontSize: 13, color: "#c00", marginTop: 4, marginBottom: 16 }}>{scanError}</p>}
      {!scanNotice && !scanError && <div style={{ marginBottom: 16 }} />}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
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
          style={{ width: 90 }}
        />
        <input
          type="number"
          placeholder={t("costMaxPlaceholder")}
          value={currentParams.costMax || ""}
          onChange={(e) => updateParam("costMax", e.target.value || null)}
          style={{ width: 90 }}
        />
        <input
          type="number"
          placeholder={t("powerMinPlaceholder")}
          value={currentParams.powerMin || ""}
          onChange={(e) => updateParam("powerMin", e.target.value || null)}
          style={{ width: 90 }}
        />
        <input
          type="number"
          placeholder={t("powerMaxPlaceholder")}
          value={currentParams.powerMax || ""}
          onChange={(e) => updateParam("powerMax", e.target.value || null)}
          style={{ width: 90 }}
        />

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
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16, fontSize: 14 }}>
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

      <div style={{ marginBottom: 20 }}>
        <button onClick={() => updateParam("view", "grid")} disabled={view === "grid"}>
          {t("viewGrid")}
        </button>{" "}
        <button onClick={() => updateParam("view", "list")} disabled={view === "list"}>
          {t("viewList")}
        </button>
      </div>

      {groupedEntries.map(([groupName, groupCards]) => (
        <section key={groupName} style={{ marginBottom: 32 }}>
          {groupBySet && <h2 style={{ borderBottom: "1px solid #ddd", paddingBottom: 4 }}>{groupName}</h2>}

          {groupCards.length === 0 ? (
            <p style={{ color: "#888" }}>{t("noCardsFound")}</p>
          ) : view === "grid" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 14,
              }}
            >
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
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
                  <th style={{ padding: 6 }}>{t("colName")}</th>
                  <th style={{ padding: 6 }}>{t("colCode")}</th>
                  <th style={{ padding: 6 }}>{t("colColor")}</th>
                  <th style={{ padding: 6 }}>{t("colType")}</th>
                  <th style={{ padding: 6 }}>{t("colRarity")}</th>
                  <th style={{ padding: 6 }}>{t("colCost")}</th>
                  <th style={{ padding: 6 }}>{t("colPower")}</th>
                  <th style={{ padding: 6 }}>{t("colQty")}</th>
                  <th style={{ padding: 6 }}>{t("colInDeck")}</th>
                  <th style={{ padding: 6 }}>{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {groupCards.map((card) => (
                  <CardRow key={card.cardImageId} card={card} onMutate={mutateCollection} />
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}

      {enlargedCard && <CardImageModal card={enlargedCard} onClose={() => setEnlargedCard(null)} />}
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
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8, textAlign: "center" }}>
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
        <div style={{ aspectRatio: "63 / 88", background: "#eee", borderRadius: 4 }} />
      )}
      <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600 }}>{card.cardName}</div>
      <div style={{ fontSize: 11, color: "#888" }}>{card.cardSetId}</div>

      <div style={{ fontSize: 11, minHeight: 14, marginTop: 2 }}>
        {card.quantity > 0 && (
          <span>
            {t("quantityLabel", { count: card.quantity })}
            {card.quantity > 1 && t("duplicateSuffixFull")}
          </span>
        )}
      </div>
      {card.allocatedInDecks > 0 && (
        <div style={{ fontSize: 11, color: "#555" }}>{t("inDeckCount", { count: card.allocatedInDecks })}</div>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 6 }}>
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
        style={{ fontSize: 11, display: "block", marginTop: 6 }}
      >
        {t("viewOnCardmarket")}
      </a>
    </div>
  );
}

function CardRow({
  card,
  onMutate,
}: {
  card: CardWithCollectionInfo;
  onMutate: (id: string, action: string) => void;
}) {
  const t = useTranslations("Dashboard");

  return (
    <tr style={{ borderBottom: "1px solid #eee" }}>
      <td style={{ padding: 6 }}>
        <a href={cardmarketUrl(card)} target="_blank" rel="noreferrer">
          {card.cardName}
        </a>
      </td>
      <td style={{ padding: 6 }}>{card.cardSetId}</td>
      <td style={{ padding: 6 }}>{card.cardColor}</td>
      <td style={{ padding: 6 }}>{card.cardType}</td>
      <td style={{ padding: 6 }}>{card.rarity}</td>
      <td style={{ padding: 6 }}>{card.cardCost ?? "-"}</td>
      <td style={{ padding: 6 }}>{card.cardPower ?? "-"}</td>
      <td style={{ padding: 6 }}>
        {card.quantity}
        {card.quantity > 1 ? t("duplicateSuffixShort") : ""}
      </td>
      <td style={{ padding: 6 }}>{card.allocatedInDecks > 0 ? card.allocatedInDecks : "-"}</td>
      <td style={{ padding: 6, whiteSpace: "nowrap" }}>
        <button onClick={() => onMutate(card.cardImageId, "decrement")}>−</button>{" "}
        <button onClick={() => onMutate(card.cardImageId, "increment")}>+</button>{" "}
        <button
          onClick={() => onMutate(card.cardImageId, "toggleWantsTrade")}
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
          <div style={{ position: "relative", width: "100%", aspectRatio: "63 / 88" }}>
            <Image
              src={`/api/catalog-image/${card.localImagePath}`}
              alt={card.cardName}
              fill
              sizes="(max-width: 600px) 100vw, 420px"
              style={{ objectFit: "contain" }}
            />
          </div>
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
