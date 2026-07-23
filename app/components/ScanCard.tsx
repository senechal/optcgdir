"use client";

import { useState, type ChangeEvent } from "react";
import CardImage from "./CardImage";

type CardCandidate = {
  cardImageId: string;
  cardSetId: string;
  cardName: string;
  cardType: string;
  rarity: string | null;
  isParallel: boolean;
  sourceType: string;
  localImagePath: string | null;
  score: number;
};

export default function ScanCard() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CardCandidate[] | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [confirmedName, setConfirmedName] = useState<string | null>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setCandidates(null);
    setConfirmedName(null);
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/scan", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Falha ao processar a foto");
        return;
      }
      setExtractedText(data.extractedText ?? "");
      setCandidates(data.candidates ?? []);
    } catch {
      setError("Falha ao enviar a foto");
    } finally {
      setLoading(false);
    }
  }

  async function confirmCard(card: CardCandidate) {
    await fetch("/api/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardImageId: card.cardImageId, action: "increment" }),
    });
    setConfirmedName(card.cardName);
    setCandidates(null);
    setPreviewUrl(null);
  }

  const manualSearchHref = extractedText
    ? `/?search=${encodeURIComponent(extractedText.split(/\r?\n/)[0] ?? "")}`
    : "/";

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>📷 Escanear carta</h1>
      <p style={{ fontSize: 13, color: "#888" }}>
        Tire uma foto da carta — tente deixar ela bem enquadrada e iluminada.
      </p>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ marginBottom: 12 }}
      />

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Foto da carta"
          style={{ width: "100%", maxWidth: 240, borderRadius: 8, marginBottom: 12, display: "block" }}
        />
      )}

      {loading && <p>Processando foto...</p>}
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      {confirmedName && (
        <p style={{ color: "#080" }}>
          &quot;{confirmedName}&quot; adicionada à coleção! Pode escanear a próxima.
        </p>
      )}

      {candidates && candidates.length === 0 && !loading && (
        <div>
          <p style={{ color: "#888" }}>Nenhum match confiável encontrado.</p>
          <a href={manualSearchHref}>Buscar manualmente no catálogo →</a>
        </div>
      )}

      {candidates && candidates.length > 0 && (
        <div>
          <p style={{ fontSize: 13, color: "#888" }}>
            Não é a carta certa? <a href={manualSearchHref}>buscar manualmente</a>.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gap: 12,
            }}
          >
            {candidates.map((card) => (
              <div
                key={card.cardImageId}
                style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8, textAlign: "center" }}
              >
                {card.localImagePath ? (
                  <CardImage src={`/api/catalog-image/${card.localImagePath}`} alt={card.cardName} />
                ) : (
                  <div style={{ aspectRatio: "63 / 88", background: "#eee", borderRadius: 4 }} />
                )}
                <div style={{ fontSize: 12, marginTop: 4, fontWeight: 600 }}>{card.cardName}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{card.cardSetId}</div>
                <button onClick={() => confirmCard(card)} style={{ marginTop: 6 }}>
                  Confirmar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
