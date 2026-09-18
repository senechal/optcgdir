import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CollectionStatusBadge from "./CollectionStatusBadge";

describe("CollectionStatusBadge", () => {
  it("renders nothing when the quantity is zero", () => {
    const { container } = render(<CollectionStatusBadge quantity={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a blue badge with no plus for a single copy", () => {
    render(<CollectionStatusBadge quantity={1} />);
    const badge = screen.getByTestId("collection-status-badge");
    expect(badge).toHaveStyle({ background: "var(--color-accent)" });
    expect(screen.queryByText("+")).not.toBeInTheDocument();
  });

  it("shows a yellow badge for an incomplete playset (2-4 copies)", () => {
    render(<CollectionStatusBadge quantity={3} />);
    expect(screen.getByTestId("collection-status-badge")).toHaveStyle({ background: "var(--color-warning)" });
    expect(screen.queryByText("+")).not.toBeInTheDocument();
  });

  it("shows a green badge with no plus for exactly a complete playset (5 copies)", () => {
    render(<CollectionStatusBadge quantity={5} />);
    expect(screen.getByTestId("collection-status-badge")).toHaveStyle({ background: "var(--color-success)" });
    expect(screen.queryByText("+")).not.toBeInTheDocument();
  });

  it("shows a green badge with a plus indicator for extra copies beyond the playset", () => {
    render(<CollectionStatusBadge quantity={7} />);
    expect(screen.getByTestId("collection-status-badge")).toHaveStyle({ background: "var(--color-success)" });
    expect(screen.getByText("+")).toBeInTheDocument();
  });

  it("renders a smaller badge for the 'sm' size variant", () => {
    render(<CollectionStatusBadge quantity={1} size="sm" />);
    expect(screen.getByTestId("collection-status-badge")).toHaveStyle({ width: "14px", height: "14px" });
  });
});
