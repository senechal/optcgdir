import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "../test-utils";
import Toast from "./Toast";

describe("Toast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the message and calls onDismiss when the close button is clicked", () => {
    const onDismiss = vi.fn();
    renderWithIntl(<Toast message="Carta encontrada" variant="success" onDismiss={onDismiss} />);

    expect(screen.getByText("Carta encontrada")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Fechar"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("auto-dismisses after the timeout", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    renderWithIntl(<Toast message="Algo deu errado" variant="error" onDismiss={onDismiss} />);

    expect(onDismiss).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
