"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import CardImage from "./CardImage";
import type { CardWithCollectionInfo } from "../lib/dashboardTypes";

// Modal centralizado em telas largas, drawer colado na base em telas
// estreitas (mesmo componente — só muda via media query no CSS, sem
// precisar detectar o device em JS).
export default function CardImageModal({
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
          className="icon-btn"
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
          <div style={{ aspectRatio: "63 / 88", background: "var(--color-bg-subtle)", borderRadius: "var(--radius-sm)" }} />
        )}
        <div style={{ marginTop: 10, fontWeight: 600 }}>{card.cardName}</div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{card.cardSetId}</div>
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
          background: var(--color-surface);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          padding: var(--space-4);
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
            border-radius: var(--radius-lg) var(--radius-lg) 0 0;
          }
        }
      `}</style>
    </div>
  );
}
