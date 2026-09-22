"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import CardImage from "./CardImage";

export default function AdminCardImageEditor({
  cardImageId,
  cardName,
  cardSetId,
  localImagePath,
}: {
  cardImageId: string;
  cardName: string;
  cardSetId: string;
  localImagePath: string | null;
}) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // React zera e.currentTarget assim que o handler síncrono termina, então
    // guardamos a referência do form antes do primeiro await — usá-la depois
    // disso lançaria um TypeError silencioso (capturado pelo catch abaixo
    // como "erro genérico", escondendo o bug de verdade).
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("cardImageId", cardImageId);

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/card-image", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t("saveError"));
        return;
      }
      form.reset();
      router.refresh();
    } catch {
      setError(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-3)",
        alignItems: "flex-start",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-3)",
      }}
    >
      <div style={{ width: 90, flexShrink: 0 }}>
        <CardImage src={localImagePath ? `/api/catalog-image/${localImagePath}` : null} alt={cardName} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{cardName}</div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: "var(--space-2)" }}>
          {cardSetId} · {cardImageId}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
          <input type="file" name="file" accept="image/*" disabled={saving} />
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{t("or")}</span>
          <input type="url" name="url" placeholder={t("urlPlaceholder")} disabled={saving} style={{ flex: "1 1 220px" }} />
          <button type="submit" disabled={saving}>
            {saving ? t("saving") : t("save")}
          </button>
        </form>
        {error && <p style={{ color: "var(--color-danger)", fontSize: 13, marginTop: 4 }}>{error}</p>}
      </div>
    </div>
  );
}
