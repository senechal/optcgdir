"use client";

import { useTranslations } from "next-intl";
import type { DraftFilters, FilterOptions } from "../lib/dashboardTypes";

export default function FiltersPanel({
  draftFilters,
  setDraftFilters,
  filterOptions,
  onApply,
}: {
  draftFilters: DraftFilters;
  setDraftFilters: (updater: (prev: DraftFilters) => DraftFilters) => void;
  filterOptions: FilterOptions;
  onApply: () => void;
}) {
  const t = useTranslations("Dashboard");

  return (
    <div className="filters-panel">
      <div className="filters-grid">
        <select
          value={draftFilters.color}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, color: e.target.value }))}
        >
          <option value="">{t("filterColorAll")}</option>
          {filterOptions.colors.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <select
          value={draftFilters.rarity}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, rarity: e.target.value }))}
        >
          <option value="">{t("filterRarityAll")}</option>
          {filterOptions.rarities.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <select
          value={draftFilters.type}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, type: e.target.value }))}
        >
          <option value="">{t("filterTypeAll")}</option>
          {filterOptions.types.map((typeOption) => (
            <option key={typeOption} value={typeOption}>
              {typeOption}
            </option>
          ))}
        </select>

        <select
          value={draftFilters.set}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, set: e.target.value }))}
        >
          <option value="">{t("filterSetAll")}</option>
          {filterOptions.sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder={t("costMinPlaceholder")}
          value={draftFilters.costMin}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, costMin: e.target.value }))}
        />
        <input
          type="number"
          placeholder={t("costMaxPlaceholder")}
          value={draftFilters.costMax}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, costMax: e.target.value }))}
        />
        <input
          type="number"
          placeholder={t("powerMinPlaceholder")}
          value={draftFilters.powerMin}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, powerMin: e.target.value }))}
        />
        <input
          type="number"
          placeholder={t("powerMaxPlaceholder")}
          value={draftFilters.powerMax}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, powerMax: e.target.value }))}
        />
      </div>

      <div className="filters-checkboxes">
        <label>
          <input
            type="checkbox"
            checked={draftFilters.inDeck}
            onChange={() => setDraftFilters((prev) => ({ ...prev, inDeck: !prev.inDeck }))}
          />{" "}
          {t("onlyInDeck")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={draftFilters.counter}
            onChange={() => setDraftFilters((prev) => ({ ...prev, counter: !prev.counter }))}
          />{" "}
          {t("onlyCounter")}
        </label>
      </div>

      <div className="filters-apply-row">
        <button type="button" className="filters-apply-button" onClick={onApply}>
          {t("applyFilters")}
        </button>
      </div>

      <style jsx>{`
        .filters-panel {
          padding: var(--space-4);
          margin-bottom: var(--space-4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          background: var(--color-surface);
        }
        .filters-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }
        .filters-checkboxes {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2) var(--space-5);
          font-size: var(--font-size-sm);
        }

        .filters-apply-row {
          display: flex;
          justify-content: flex-end;
          margin-top: var(--space-4);
        }
        .filters-apply-button {
          background: var(--color-accent);
          border-color: var(--color-accent);
          color: #fff;
          font-weight: 600;
        }
        .filters-apply-button:hover {
          background: var(--color-accent-hover);
          border-color: var(--color-accent-hover);
        }
      `}</style>
    </div>
  );
}
