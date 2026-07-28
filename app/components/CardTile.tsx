"use client";

import { useTranslations } from "next-intl";
import CardImage from "./CardImage";
import { cardmarketUrl } from "../lib/cardDisplay";
import type { CardWithCollectionInfo } from "../lib/dashboardTypes";

export default function CardTile({
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
        <button className="icon-btn" onClick={() => onMutate(card.cardImageId, "decrement")} title={t("removeOne")}>
          −
        </button>
        <button className="icon-btn" onClick={() => onMutate(card.cardImageId, "increment")} title={t("addOne")}>
          +
        </button>
        <button
          className="icon-btn"
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
