"use client";

import { useTranslations } from "next-intl";
import type { FilterOptions } from "../lib/dashboardTypes";

// Pills dos filtros REALMENTE aplicados (vêm da URL, não do rascunho) —
// cada um removível na hora, sem precisar abrir o painel nem clicar em
// "Aplicar".
function buildPills(
  currentParams: Record<string, string>,
  filterOptions: FilterOptions,
  t: (key: string, values?: Record<string, string | number>) => string
): { key: string; text: string }[] {
  const pills: { key: string; text: string }[] = [];
  if (currentParams.color) {
    const label = filterOptions.colors.find((c) => c.value === currentParams.color)?.label ?? currentParams.color;
    pills.push({ key: "color", text: `${t("colColor")}: ${label}` });
  }
  if (currentParams.rarity) {
    pills.push({ key: "rarity", text: `${t("colRarity")}: ${currentParams.rarity}` });
  }
  if (currentParams.type) {
    pills.push({ key: "type", text: `${t("colType")}: ${currentParams.type}` });
  }
  if (currentParams.set) {
    const label = filterOptions.sets.find((s) => s.id === currentParams.set)?.name ?? currentParams.set;
    pills.push({ key: "set", text: `${t("colSet")}: ${label}` });
  }
  if (currentParams.costMin) pills.push({ key: "costMin", text: `${t("colCost")} ≥ ${currentParams.costMin}` });
  if (currentParams.costMax) pills.push({ key: "costMax", text: `${t("colCost")} ≤ ${currentParams.costMax}` });
  if (currentParams.powerMin) pills.push({ key: "powerMin", text: `${t("colPower")} ≥ ${currentParams.powerMin}` });
  if (currentParams.powerMax) pills.push({ key: "powerMax", text: `${t("colPower")} ≤ ${currentParams.powerMax}` });
  if (currentParams.inDeck === "1") pills.push({ key: "inDeck", text: t("onlyInDeck") });
  if (currentParams.counter === "1") pills.push({ key: "counter", text: t("onlyCounter") });
  return pills;
}

export default function FilterPills({
  currentParams,
  filterOptions,
  onRemove,
}: {
  currentParams: Record<string, string>;
  filterOptions: FilterOptions;
  onRemove: (key: string) => void;
}) {
  const t = useTranslations("Dashboard");
  const pills = buildPills(currentParams, filterOptions, t);

  if (pills.length === 0) return null;

  return (
    <div className="filter-pills">
      {pills.map((pill) => (
        <span key={pill.key} className="filter-pill">
          {pill.text}
          <button
            type="button"
            className="filter-pill-remove"
            onClick={() => onRemove(pill.key)}
            aria-label={t("removeFilter", { filter: pill.text })}
          >
            ✕
          </button>
        </span>
      ))}

      <style jsx>{`
        .filter-pills {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          margin-top: var(--space-2);
        }
        .filter-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 4px 4px 10px;
          border-radius: var(--radius-full);
          background: var(--color-accent-subtle);
          color: var(--color-accent-hover);
          font-size: var(--font-size-xs);
          font-weight: 500;
        }
        .filter-pill-remove {
          all: unset;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          min-height: 18px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 11px;
          color: var(--color-accent-hover);
        }
        .filter-pill-remove:hover {
          background: rgba(0, 0, 0, 0.08);
        }
      `}</style>
    </div>
  );
}
