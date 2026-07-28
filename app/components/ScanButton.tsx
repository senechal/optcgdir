"use client";

import { useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import type { ScanCandidate } from "../lib/dashboardTypes";

// Botão de escanear-pra-buscar: fotografa uma carta, manda pro /api/scan, e
// devolve pro pai a lista de candidatos inteira (via onCandidates) em vez de
// aplicar cegamente o #1 na busca — o matching por nome/código erra o
// candidato certo com frequência real (ver
// memory/ocr_code_recognition_limitation.md, ~metade das fotos testadas),
// então deixar o usuário escolher entre os melhores palpites com 1 toque
// evita cair silenciosamente numa busca errada.
export default function ScanButton({
  onCandidates,
  onNotice,
  onError,
}: {
  onCandidates: (candidates: ScanCandidate[]) => void;
  onNotice: (message: string | null) => void;
  onError: (message: string | null) => void;
}) {
  const t = useTranslations("Dashboard");
  const [scanning, setScanning] = useState(false);

  async function handleScanFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escanear a mesma foto de novo em seguida

    if (!file) return;

    onError(null);
    onNotice(null);
    setScanning(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/scan", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error || t("scanErrorGeneric"));
        return;
      }

      const candidates: ScanCandidate[] = data.candidates ?? [];
      if (candidates.length === 0) {
        onError(t("scanErrorNoCandidates"));
        return;
      }

      onNotice(t("scanNoticeChooseCandidate"));
      onCandidates(candidates);
    } catch {
      onError(t("scanErrorUpload"));
    } finally {
      setScanning(false);
    }
  }

  return (
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

      <style jsx>{`
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
      `}</style>
    </label>
  );
}
