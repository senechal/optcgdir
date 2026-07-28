import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "../test-utils";
import ScanCandidatesList from "./ScanCandidatesList";
import type { ScanCandidate } from "../lib/dashboardTypes";

function candidate(overrides: Partial<ScanCandidate> = {}): ScanCandidate {
  return {
    cardImageId: "OP01-001",
    cardSetId: "OP01-001",
    cardName: "Monkey.D.Luffy",
    matchedByCode: false,
    localImagePath: null,
    ...overrides,
  };
}

describe("ScanCandidatesList", () => {
  it("renders every candidate's name and code", () => {
    renderWithIntl(
      <ScanCandidatesList
        candidates={[candidate(), candidate({ cardImageId: "OP01-002", cardName: "Nami", cardSetId: "OP01-002" })]}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByText("Monkey.D.Luffy")).toBeInTheDocument();
    expect(screen.getByText("Nami")).toBeInTheDocument();
    expect(screen.getByText("OP01-001")).toBeInTheDocument();
    expect(screen.getByText("OP01-002")).toBeInTheDocument();
  });

  it("shows a code-match badge only for candidates matched by the printed code", () => {
    renderWithIntl(
      <ScanCandidatesList candidates={[candidate({ matchedByCode: true })]} onSelect={vi.fn()} onDismiss={vi.fn()} />
    );
    expect(screen.getByText("código")).toBeInTheDocument();
  });

  it("omits the code-match badge for name-based candidates", () => {
    renderWithIntl(
      <ScanCandidatesList candidates={[candidate({ matchedByCode: false })]} onSelect={vi.fn()} onDismiss={vi.fn()} />
    );
    expect(screen.queryByText("código")).not.toBeInTheDocument();
  });

  it("shows a placeholder block instead of an image when there's no local image", () => {
    const { container } = renderWithIntl(
      <ScanCandidatesList candidates={[candidate({ localImagePath: null })]} onSelect={vi.fn()} onDismiss={vi.fn()} />
    );
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("calls onSelect with the clicked candidate", () => {
    const onSelect = vi.fn();
    const c = candidate();
    renderWithIntl(<ScanCandidatesList candidates={[c]} onSelect={onSelect} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByText("Monkey.D.Luffy"));
    expect(onSelect).toHaveBeenCalledWith(c);
  });

  it("calls onDismiss when the close button is clicked", () => {
    const onDismiss = vi.fn();
    renderWithIntl(<ScanCandidatesList candidates={[candidate()]} onSelect={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText("Fechar"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
