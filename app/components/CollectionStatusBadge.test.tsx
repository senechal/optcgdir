import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CollectionStatusBadge from "./CollectionStatusBadge";

describe("CollectionStatusBadge", () => {
  it("renders nothing when the quantity is zero", () => {
    const { container } = render(<CollectionStatusBadge quantity={0} cardType="Character" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a blue badge with no plus for a single copy", () => {
    render(<CollectionStatusBadge quantity={1} cardType="Character" />);
    const badge = screen.getByTestId("collection-status-badge");
    expect(badge).toHaveStyle({ background: "var(--color-accent)" });
    expect(screen.queryByTestId("collection-status-badge-plus")).not.toBeInTheDocument();
  });

  it("shows a yellow badge for an incomplete playset (2-4 copies)", () => {
    render(<CollectionStatusBadge quantity={3} cardType="Character" />);
    expect(screen.getByTestId("collection-status-badge")).toHaveStyle({ background: "var(--color-warning)" });
    expect(screen.queryByTestId("collection-status-badge-plus")).not.toBeInTheDocument();
  });

  it("shows a green badge with no plus for exactly a complete playset (5 copies)", () => {
    render(<CollectionStatusBadge quantity={5} cardType="Character" />);
    expect(screen.getByTestId("collection-status-badge")).toHaveStyle({ background: "var(--color-success)" });
    expect(screen.queryByTestId("collection-status-badge-plus")).not.toBeInTheDocument();
  });

  it("shows a green badge with a plus indicator for extra copies beyond the playset", () => {
    render(<CollectionStatusBadge quantity={7} cardType="Character" />);
    expect(screen.getByTestId("collection-status-badge")).toHaveStyle({ background: "var(--color-success)" });
    expect(screen.getByTestId("collection-status-badge-plus")).toBeInTheDocument();
  });

  it("renders a smaller badge for the 'sm' size variant", () => {
    render(<CollectionStatusBadge quantity={1} cardType="Character" size="sm" />);
    expect(screen.getByTestId("collection-status-badge")).toHaveStyle({ width: "14px", height: "14px" });
  });

  it("treats a leader's playset as complete with 2 copies, skipping the yellow range", () => {
    render(<CollectionStatusBadge quantity={2} cardType="Leader" />);
    expect(screen.getByTestId("collection-status-badge")).toHaveStyle({ background: "var(--color-success)" });
    expect(screen.queryByTestId("collection-status-badge-plus")).not.toBeInTheDocument();
  });

  it("shows the plus indicator for a leader with more than 2 copies", () => {
    render(<CollectionStatusBadge quantity={3} cardType="Leader" />);
    expect(screen.getByTestId("collection-status-badge")).toHaveStyle({ background: "var(--color-success)" });
    expect(screen.getByTestId("collection-status-badge-plus")).toBeInTheDocument();
  });
});
