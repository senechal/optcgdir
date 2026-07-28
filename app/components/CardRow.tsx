"use client";

import { useTranslations } from "next-intl";
import CardImage from "./CardImage";
import { cardmarketUrl } from "../lib/cardDisplay";
import type { CardWithCollectionInfo } from "../lib/dashboardTypes";

// Estilos da tabela (.card-table, .col-*, etc.) ficam em Dashboard.tsx como
// <style jsx global> — é lá que a <table> em si é renderizada, e um <style>
// não pode ser filho de <tr>/<tbody> (HTML inválido).
export default function CardRow({
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
      </td>
    </tr>
  );
}
