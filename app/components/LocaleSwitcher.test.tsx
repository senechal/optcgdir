import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LocaleSwitcher from "./LocaleSwitcher";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const setLocale = vi.fn().mockResolvedValue(undefined);
vi.mock("../actions/setLocale", () => ({
  setLocale: (...args: unknown[]) => setLocale(...args),
}));

describe("LocaleSwitcher", () => {
  beforeEach(() => {
    refresh.mockClear();
    setLocale.mockClear();
  });

  it("renders both locale options", () => {
    render(<LocaleSwitcher current="pt-BR" />);
    expect(screen.getByText("PT")).toBeInTheDocument();
    expect(screen.getByText("EN")).toBeInTheDocument();
  });

  it("styles the current locale's button as active (bold, default cursor)", () => {
    render(<LocaleSwitcher current="pt-BR" />);
    const ptButton = screen.getByText("PT") as HTMLButtonElement;
    const enButton = screen.getByText("EN") as HTMLButtonElement;
    expect(ptButton.style.fontWeight).toBe("600");
    expect(ptButton.style.cursor).toBe("default");
    expect(enButton.style.fontWeight).toBe("400");
    expect(enButton.style.cursor).toBe("pointer");
  });

  it("switches locale and refreshes when clicking a different option", async () => {
    render(<LocaleSwitcher current="pt-BR" />);
    fireEvent.click(screen.getByText("EN"));
    await waitFor(() => expect(setLocale).toHaveBeenCalledWith("en"));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("does nothing when clicking the already-current locale", () => {
    render(<LocaleSwitcher current="pt-BR" />);
    fireEvent.click(screen.getByText("PT"));
    expect(setLocale).not.toHaveBeenCalled();
  });
});
