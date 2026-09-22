import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithIntl } from "../test-utils";
import AdminCardImageEditor from "./AdminCardImageEditor";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function renderEditor(overrides: Partial<Parameters<typeof AdminCardImageEditor>[0]> = {}) {
  return renderWithIntl(
    <AdminCardImageEditor
      cardImageId="OP01-001"
      cardName="Monkey.D.Luffy"
      cardSetId="OP01-001"
      localImagePath={null}
      {...overrides}
    />
  );
}

describe("AdminCardImageEditor", () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ localImagePath: "x.jpg" }) }));
  });

  it("shows the card name and identifiers", () => {
    renderEditor();
    expect(screen.getByText("Monkey.D.Luffy")).toBeInTheDocument();
    expect(screen.getByText("OP01-001 · OP01-001")).toBeInTheDocument();
  });

  it("submits the form to the admin endpoint with the cardImageId attached, then refreshes", async () => {
    const { container } = renderEditor();
    const urlInput = container.querySelector('input[name="url"]') as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: "https://example.com/art.jpg" } });
    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toBe("/api/admin/card-image");
    expect(options.body.get("cardImageId")).toBe("OP01-001");
    expect(options.body.get("url")).toBe("https://example.com/art.jpg");

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it("shows the server's error message and doesn't refresh when the save fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "URL inválida" }) })
    );
    renderEditor();
    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => expect(screen.getByText("URL inválida")).toBeInTheDocument());
    expect(refresh).not.toHaveBeenCalled();
  });

  it("falls back to a generic error message when the response has no error body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => { throw new Error("no body"); } }));
    renderEditor();
    fireEvent.click(screen.getByText("Salvar"));
    await waitFor(() => expect(screen.getByText("Não foi possível salvar a imagem.")).toBeInTheDocument());
  });

  it("shows a generic error when the fetch itself throws (network failure)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    renderEditor();
    fireEvent.click(screen.getByText("Salvar"));
    await waitFor(() => expect(screen.getByText("Não foi possível salvar a imagem.")).toBeInTheDocument());
  });

  it("disables the form controls while saving", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)))
    );
    renderEditor();
    fireEvent.click(screen.getByText("Salvar"));

    expect(screen.getByText("Salvando...")).toBeInTheDocument();
    expect(screen.getByText("Salvando...")).toBeDisabled();

    resolveFetch({ ok: true, json: async () => ({}) });
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });
});
