"use client";

import { useTranslations } from "next-intl";
import CardImage from "./CardImage";
import type { ScanCandidate } from "../lib/dashboardTypes";

export default function ScanCandidatesList({
  candidates,
  onSelect,
  onDismiss,
}: {
  candidates: ScanCandidate[];
  onSelect: (candidate: ScanCandidate) => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("Dashboard");

  return (
    <div className="scan-candidates">
      <div className="scan-candidates-header">
        <button type="button" className="scan-candidates-dismiss" onClick={onDismiss}>
          {t("scanCandidatesDismiss")}
        </button>
      </div>
      <div className="scan-candidates-row">
        {candidates.map((candidate) => (
          <button
            type="button"
            key={candidate.cardImageId}
            className="scan-candidate"
            onClick={() => onSelect(candidate)}
          >
            {candidate.localImagePath ? (
              <CardImage src={`/api/catalog-image/${candidate.localImagePath}`} alt={candidate.cardName} />
            ) : (
              <div className="scan-candidate-placeholder" />
            )}
            <span className="scan-candidate-name">{candidate.cardName}</span>
            <span className="scan-candidate-code">
              {candidate.cardSetId}
              {candidate.matchedByCode && (
                <span className="scan-candidate-badge">{t("scanCandidateMatchedByCode")}</span>
              )}
            </span>
          </button>
        ))}
      </div>

      <style jsx>{`
        .scan-candidates {
          margin-top: var(--space-2);
          padding: var(--space-2) var(--space-3) var(--space-3);
          border: 1px solid var(--color-border-strong);
          border-radius: var(--radius-md);
          background: var(--color-surface);
        }
        .scan-candidates-header {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          margin-bottom: var(--space-2);
        }
        .scan-candidates-dismiss {
          background: none;
          border: none;
          color: var(--color-text-secondary);
          cursor: pointer;
          font-size: var(--font-size-sm);
          padding: 0;
        }
        .scan-candidates-row {
          display: flex;
          gap: var(--space-2);
          overflow-x: auto;
          padding-bottom: var(--space-1);
        }
        .scan-candidate {
          all: unset;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 96px;
          flex: 0 0 auto;
          text-align: center;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-2);
          background: var(--color-bg-subtle);
        }
        @media (hover: hover) {
          .scan-candidate:hover {
            border-color: var(--color-accent);
          }
        }
        .scan-candidate-placeholder {
          width: 100%;
          aspect-ratio: 63 / 88;
          background: var(--color-bg-subtle);
          border-radius: var(--radius-sm);
        }
        .scan-candidate-name {
          font-size: var(--font-size-xs);
          font-weight: 600;
          margin-top: var(--space-1);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          width: 100%;
        }
        .scan-candidate-code {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }
        .scan-candidate-badge {
          display: inline-block;
          margin-left: 4px;
          padding: 0 4px;
          border-radius: var(--radius-full);
          background: var(--color-accent);
          color: #fff;
          font-size: 9px;
        }
      `}</style>
    </div>
  );
}
