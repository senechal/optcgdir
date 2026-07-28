import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "../test-utils";
import TabsBar from "./TabsBar";

describe("TabsBar", () => {
  it("renders all 5 tabs with their translated labels", () => {
    renderWithIntl(<TabsBar activeTab="all" onSelectTab={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Todos" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Por Set" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Minha Coleção" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Duplicatas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Quero Trocar" })).toBeInTheDocument();
  });

  it("marks only the active tab as selected", () => {
    renderWithIntl(<TabsBar activeTab="duplicates" onSelectTab={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Duplicatas" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Todos" })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onSelectTab with the clicked tab's value", () => {
    const onSelectTab = vi.fn();
    renderWithIntl(<TabsBar activeTab="all" onSelectTab={onSelectTab} />);
    fireEvent.click(screen.getByRole("tab", { name: "Minha Coleção" }));
    expect(onSelectTab).toHaveBeenCalledWith("owned");
  });
});
