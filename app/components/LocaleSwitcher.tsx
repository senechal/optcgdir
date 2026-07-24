"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "../actions/setLocale";
import type { Locale } from "../i18n/request";

// Cada idioma mostra o próprio nome nativo (padrão comum de seletor de
// idioma) — não precisa de tradução, então não entra no dicionário.
const OPTIONS: { locale: Locale; label: string }[] = [
  { locale: "pt-BR", label: "PT" },
  { locale: "en", label: "EN" },
];

export default function LocaleSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick(locale: Locale) {
    if (locale === current || isPending) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  }

  return (
    <div style={{ display: "inline-flex", gap: 4, fontSize: 12 }}>
      {OPTIONS.map((option) => (
        <button
          key={option.locale}
          type="button"
          onClick={() => handleClick(option.locale)}
          disabled={isPending}
          style={{
            border: "1px solid #ccc",
            borderRadius: 4,
            padding: "2px 6px",
            background: option.locale === current ? "#333" : "transparent",
            color: option.locale === current ? "#fff" : "#666",
            cursor: option.locale === current ? "default" : "pointer",
            fontWeight: option.locale === current ? 600 : 400,
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
