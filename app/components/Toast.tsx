"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

const AUTO_DISMISS_MS = 6000;

// Notificação flutuante (não ocupa espaço no layout, ao contrário do antigo
// texto fixo embaixo da busca) — some sozinha depois de um tempo ou ao
// clicar no X.
export default function Toast({
  message,
  variant,
  onDismiss,
}: {
  message: string;
  variant: "success" | "error";
  onDismiss: () => void;
}) {
  const tCommon = useTranslations("Common");

  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  return (
    <div className={`toast toast-${variant}`} role="status">
      <span className="toast-message">{message}</span>
      <button type="button" className="toast-close" onClick={onDismiss} aria-label={tCommon("close")}>
        ✕
      </button>

      <style jsx>{`
        .toast {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          background: var(--color-surface);
          border-left: 4px solid;
          min-width: 240px;
          max-width: 360px;
        }
        .toast-success {
          border-left-color: var(--color-success);
        }
        .toast-error {
          border-left-color: var(--color-danger);
        }
        .toast-message {
          flex: 1;
          font-size: var(--font-size-sm);
        }
        .toast-success .toast-message {
          color: var(--color-success);
        }
        .toast-error .toast-message {
          color: var(--color-danger);
        }
        .toast-close {
          border: none;
          background: none;
          cursor: pointer;
          line-height: 1;
          color: var(--color-text-secondary);
          padding: 0;
          flex-shrink: 0;
        }
        @media (max-width: 699px) {
          .toast {
            max-width: none;
          }
        }
      `}</style>
    </div>
  );
}
