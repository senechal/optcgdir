"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import CardImage from "./CardImage";

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
  colors: string[];
  rarities: string[];
  types: string[];
};

function cardmarketUrl(card: CardWithCollectionInfo) {
  // O card_name da optcgapi já vem com sufixos como "(Parallel)" ou
  // "(Alternative Art)" — removemos aqui porque a variante já é
  // representada separadamente por V.1/V.2/Promo.
  const baseName = card.cardName.replace(/\s*\([^)]*\)\s*$/, "");
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
}: {
  cards: CardWithCollectionInfo[];
  filterOptions: FilterOptions;
  currentParams: Record<string, string>;
  view: "grid" | "list";
  groupBySet: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(currentParams.search || "");

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
    : [["Todas as cartas", cards]];

  return (
    <div style={{ fontFamily: "sans-serif", padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ marginBottom: 4 }}>OPTCG Collection Manager</h1>
        <a href="/scan" style={{ fontSize: 13, whiteSpace: "nowrap" }}>
          📷 Escanear carta
        </a>
      </div>
      <p style={{ color: "#888", marginTop: 0, marginBottom: 20 }}>
        {cards.length} carta(s) encontradas {isPending && "— atualizando..."}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParam("search", searchInput || null);
        }}
        style={{ marginBottom: 16 }}
      >
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por nome, código (ex: OP01-001) ou texto do efeito..."
          style={{ padding: 8, width: 380, marginRight: 8 }}
        />
        <button type="submit">Buscar</button>
        {currentParams.search && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              updateParam("search", null);
            }}
            style={{ marginLeft: 8 }}
          >
            Limpar busca
          </button>
        )}
      </form>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <select
          value={currentParams.color || ""}
          onChange={(e) => updateParam("color", e.target.value || null)}
        >
          <option value="">Cor: todas</option>
          {filterOptions.colors.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={currentParams.rarity || ""}
          onChange={(e) => updateParam("rarity", e.target.value || null)}
        >
          <option value="">Raridade: todas</option>
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
          <option value="">Tipo: todos</option>
          {filterOptions.types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          value={currentParams.set || ""}
          onChange={(e) => updateParam("set", e.target.value || null)}
        >
          <option value="">Set: todos</option>
          {filterOptions.sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Custo mín."
          value={currentParams.costMin || ""}
          onChange={(e) => updateParam("costMin", e.target.value || null)}
          style={{ width: 90 }}
        />
        <input
          type="number"
          placeholder="Custo máx."
          value={currentParams.costMax || ""}
          onChange={(e) => updateParam("costMax", e.target.value || null)}
          style={{ width: 90 }}
        />
        <input
          type="number"
          placeholder="Poder mín."
          value={currentParams.powerMin || ""}
          onChange={(e) => updateParam("powerMin", e.target.value || null)}
          style={{ width: 90 }}
        />
        <input
          type="number"
          placeholder="Poder máx."
          value={currentParams.powerMax || ""}
          onChange={(e) => updateParam("powerMax", e.target.value || null)}
          style={{ width: 90 }}
        />

        <select
          value={currentParams.sort || "code"}
          onChange={(e) => updateParam("sort", e.target.value)}
        >
          <option value="code">Ordenar: código</option>
          <option value="name">Ordenar: nome</option>
          <option value="cost">Ordenar: custo</option>
          <option value="power">Ordenar: poder</option>
          <option value="rarity">Ordenar: raridade</option>
          <option value="set">Ordenar: set</option>
          <option value="dateAdded">Ordenar: sincronizado recentemente</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16, fontSize: 14 }}>
        <label>
          <input
            type="checkbox"
            checked={currentParams.owned === "1"}
            onChange={() => toggleParam("owned")}
          />{" "}
          Só na minha coleção
        </label>
        <label>
          <input
            type="checkbox"
            checked={currentParams.duplicates === "1"}
            onChange={() => toggleParam("duplicates")}
          />{" "}
          Só duplicatas
        </label>
        <label>
          <input
            type="checkbox"
            checked={currentParams.wantsTrade === "1"}
            onChange={() => toggleParam("wantsTrade")}
          />{" "}
          Só "quero trocar"
        </label>
        <label>
          <input
            type="checkbox"
            checked={currentParams.inDeck === "1"}
            onChange={() => toggleParam("inDeck")}
          />{" "}
          Só em algum deck
        </label>
        <label>
          <input
            type="checkbox"
            checked={currentParams.counter === "1"}
            onChange={() => toggleParam("counter")}
          />{" "}
          Só com counter
        </label>
        <label>
          <input type="checkbox" checked={groupBySet} onChange={() => toggleParam("groupBySet")} />{" "}
          Agrupar por set
        </label>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button onClick={() => updateParam("view", "grid")} disabled={view === "grid"}>
          🔳 Grade
        </button>{" "}
        <button onClick={() => updateParam("view", "list")} disabled={view === "list"}>
          📋 Lista
        </button>
      </div>

      {groupedEntries.map(([groupName, groupCards]) => (
        <section key={groupName} style={{ marginBottom: 32 }}>
          {groupBySet && <h2 style={{ borderBottom: "1px solid #ddd", paddingBottom: 4 }}>{groupName}</h2>}

          {groupCards.length === 0 ? (
            <p style={{ color: "#888" }}>Nenhuma carta encontrada com esses filtros.</p>
          ) : view === "grid" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 14,
              }}
            >
              {groupCards.map((card) => (
                <CardTile key={card.cardImageId} card={card} onMutate={mutateCollection} />
              ))}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
                  <th style={{ padding: 6 }}>Nome</th>
                  <th style={{ padding: 6 }}>Código</th>
                  <th style={{ padding: 6 }}>Cor</th>
                  <th style={{ padding: 6 }}>Tipo</th>
                  <th style={{ padding: 6 }}>Raridade</th>
                  <th style={{ padding: 6 }}>Custo</th>
                  <th style={{ padding: 6 }}>Poder</th>
                  <th style={{ padding: 6 }}>Qtd</th>
                  <th style={{ padding: 6 }}>Em deck</th>
                  <th style={{ padding: 6 }}>Ações</th>
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
    </div>
  );
}

function CardTile({
  card,
  onMutate,
}: {
  card: CardWithCollectionInfo;
  onMutate: (id: string, action: string) => void;
}) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8, textAlign: "center" }}>
      {card.localImagePath ? (
        <CardImage src={`/api/catalog-image/${card.localImagePath}`} alt={card.cardName} />
      ) : (
        <div style={{ aspectRatio: "63 / 88", background: "#eee", borderRadius: 4 }} />
      )}
      <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600 }}>{card.cardName}</div>
      <div style={{ fontSize: 11, color: "#888" }}>{card.cardSetId}</div>

      <div style={{ fontSize: 11, minHeight: 14, marginTop: 2 }}>
        {card.quantity > 0 && (
          <span>
            Qtd: {card.quantity}
            {card.quantity > 1 && " · duplicata"}
          </span>
        )}
      </div>
      {card.allocatedInDecks > 0 && (
        <div style={{ fontSize: 11, color: "#555" }}>
          {card.allocatedInDecks} em deck{card.allocatedInDecks > 1 ? "s" : ""}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 6 }}>
        <button onClick={() => onMutate(card.cardImageId, "decrement")} title="Remover 1">
          −
        </button>
        <button onClick={() => onMutate(card.cardImageId, "increment")} title="Adicionar 1">
          +
        </button>
        <button
          onClick={() => onMutate(card.cardImageId, "toggleWantsTrade")}
          title="Quero trocar"
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
        Ver no Cardmarket ↗
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
        {card.quantity > 1 ? " · dup" : ""}
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
