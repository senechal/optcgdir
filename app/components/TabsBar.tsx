"use client";

import { useTranslations } from "next-intl";
import type { Tab } from "../lib/dashboardTypes";

const TABS: Tab[] = ["all", "grouped", "owned", "duplicates", "wantsTrade"];

export default function TabsBar({
  activeTab,
  onSelectTab,
}: {
  activeTab: Tab;
  onSelectTab: (tab: Tab) => void;
}) {
  const t = useTranslations("Dashboard");

  return (
    <div className="tabs-row" role="tablist">
      {TABS.map((tabValue) => (
        <button
          key={tabValue}
          type="button"
          role="tab"
          aria-selected={activeTab === tabValue}
          className={activeTab === tabValue ? "tab-button tab-button-active" : "tab-button"}
          onClick={() => onSelectTab(tabValue)}
        >
          {t(`tab_${tabValue}`)}
        </button>
      ))}

      <style jsx>{`
        .tabs-row {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-1);
          margin-bottom: var(--space-2);
        }
        .tab-button {
          background: transparent;
          border-color: transparent;
        }
        .tab-button-active {
          background: var(--color-accent-subtle);
          border-color: var(--color-accent);
          color: var(--color-accent);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
