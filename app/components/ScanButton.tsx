"use client";

import { useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { stripVariantSuffix } from "../lib/cardDisplay";
import type { ScanCandidate } from "../lib/dashboardTypes";

// Botão de escanear-pra-buscar: fotografa uma carta, manda pro /api/scan,
// e devolve pro componente pai (via onSearchTermReady) o termo de busca a
// aplicar — código impresso se o OCR achou um com confiança, senão o nome
// (mais abrangente, mas evita filtrar pela carta errada por causa de um
// código mal lido). Notice/erro sobem pro pai via callback em vez de
// renderizar aqui, porque no layout original eles ficam FORA do form de
// busca (parágrafos de largura cheia), enquanto este botão em si precisa
// continuar DENTRO do form (item do flex row de busca).
export default function ScanButton({
  onSearchTermReady,
  onNotice,
  onError,
}: {
  onSearchTermReady: (term: string) => void;
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
      const top = candidates[0];
      if (!top) {
        onError(t("scanErrorNoCandidates"));
        return;
      }

      if (top.matchedByCode) {
        onSearchTermReady(top.cardSetId);
        onNotice(t("scanNoticeByCode", { name: top.cardName, code: top.cardSetId }));
      } else {
        const searchTerm = stripVariantSuffix(top.cardName);
        onSearchTermReady(searchTerm);
        onNotice(t("scanNoticeByName", { term: searchTerm }));
      }
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
