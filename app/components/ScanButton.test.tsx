import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithIntl } from "../test-utils";
import ScanButton from "./ScanButton";

function fakeFile(name = "card.jpg") {
  return new File(["fake-bytes"], name, { type: "image/jpeg" });
}

function selectFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe("ScanButton", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows the idle label initially", () => {
    renderWithIntl(<ScanButton onCandidates={vi.fn()} onNotice={vi.fn()} onError={vi.fn()} />);
    expect(screen.getByText(/Escanear pra buscar/)).toBeInTheDocument();
  });

  it("ignores the change event when no file was actually selected", () => {
    renderWithIntl(<ScanButton onCandidates={vi.fn()} onNotice={vi.fn()} onError={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("bubbles up the full candidate list (not just the top guess) with a generic choose-one notice", async () => {
    const candidates = [
      { cardImageId: "OP12-001", cardSetId: "OP12-001", cardName: "Monkey.D.Luffy", matchedByCode: true, localImagePath: null },
      { cardImageId: "A", cardSetId: "OP15-086", cardName: "Nami (Parallel)", matchedByCode: false, localImagePath: "nami.jpg" },
    ];
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ candidates }) });
    const onCandidates = vi.fn();
    const onNotice = vi.fn();
    renderWithIntl(<ScanButton onCandidates={onCandidates} onNotice={onNotice} onError={vi.fn()} />);
    selectFile(fakeFile());
    await waitFor(() => expect(onCandidates).toHaveBeenCalledWith(candidates));
    expect(onNotice).toHaveBeenCalledWith("Selecione a carta correta:");
  });

  it("reports scanErrorNoCandidates when the API returns an empty candidate list", async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) });
    const onError = vi.fn();
    renderWithIntl(<ScanButton onCandidates={vi.fn()} onNotice={vi.fn()} onError={onError} />);
    selectFile(fakeFile());
    await waitFor(() => expect(onError).toHaveBeenCalledWith("Não foi possível identificar a carta. Tente buscar manualmente."));
  });

  it("surfaces the server's error message when the response is not ok", async () => {
    (fetch as any).mockResolvedValue({ ok: false, json: async () => ({ error: "Foto muito grande" }) });
    const onError = vi.fn();
    renderWithIntl(<ScanButton onCandidates={vi.fn()} onNotice={vi.fn()} onError={onError} />);
    selectFile(fakeFile());
    await waitFor(() => expect(onError).toHaveBeenCalledWith("Foto muito grande"));
  });

  it("falls back to a generic error message when the response has no error field", async () => {
    (fetch as any).mockResolvedValue({ ok: false, json: async () => ({}) });
    const onError = vi.fn();
    renderWithIntl(<ScanButton onCandidates={vi.fn()} onNotice={vi.fn()} onError={onError} />);
    selectFile(fakeFile());
    await waitFor(() => expect(onError).toHaveBeenCalledWith("Falha ao processar a foto"));
  });

  it("reports an upload error when the request throws (e.g. network failure)", async () => {
    (fetch as any).mockRejectedValue(new Error("network down"));
    const onError = vi.fn();
    renderWithIntl(<ScanButton onCandidates={vi.fn()} onNotice={vi.fn()} onError={onError} />);
    selectFile(fakeFile());
    await waitFor(() => expect(onError).toHaveBeenCalledWith("Falha ao enviar a foto"));
  });

  it("clears previous notice/error before starting a new scan", async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) });
    const onNotice = vi.fn();
    const onError = vi.fn();
    renderWithIntl(<ScanButton onCandidates={vi.fn()} onNotice={onNotice} onError={onError} />);
    selectFile(fakeFile());
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onNotice).toHaveBeenCalledWith(null);
    expect(onError).toHaveBeenCalledWith(null);
  });

  it("shows the scanning label while a request is in flight and disables the input", async () => {
    let resolveFetch!: (v: unknown) => void;
    (fetch as any).mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)));
    renderWithIntl(<ScanButton onCandidates={vi.fn()} onNotice={vi.fn()} onError={vi.fn()} />);
    selectFile(fakeFile());
    expect(screen.getByText(/Identificando/)).toBeInTheDocument();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    resolveFetch({ ok: true, json: async () => ({ candidates: [] }) });
    await waitFor(() => expect(screen.getByText(/Escanear pra buscar/)).toBeInTheDocument());
  });
});
