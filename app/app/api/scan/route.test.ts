// @vitest-environment node
//
// Rotas de API rodam em Node puro, não no browser — e crucialmente, o
// FormData/File globais do ambiente "jsdom" são uma implementação
// diferente da que o undici (usado pelo NextRequest.formData()) espera,
// quebrando "instanceof File" silenciosamente. "node" usa os globais reais.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

const findMany = vi.fn();
vi.mock("../../../lib/prisma", () => ({
  prisma: { card: { findMany: (...args: unknown[]) => findMany(...args) } },
}));

const sweepStaleScanTempFiles = vi.fn().mockResolvedValue(undefined);
vi.mock("../../../lib/scanTempCleanup", () => ({
  sweepStaleScanTempFiles: () => sweepStaleScanTempFiles(),
}));

const mkdir = vi.fn().mockResolvedValue(undefined);
const writeFile = vi.fn().mockResolvedValue(undefined);
const unlink = vi.fn().mockResolvedValue(undefined);
vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: (...args: unknown[]) => mkdir(...args),
    writeFile: (...args: unknown[]) => writeFile(...args),
    unlink: (...args: unknown[]) => unlink(...args),
  },
}));

import { POST } from "./route";

function requestWithPhoto(file: File | null) {
  const formData = new FormData();
  if (file) formData.set("photo", file);
  return new NextRequest("http://localhost/api/scan", { method: "POST", body: formData });
}

function fakePhoto(size = 100, type = "image/jpeg") {
  const bytes = new Uint8Array(size);
  return new File([bytes], "card.jpg", { type });
}

describe("POST /api/scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mkdir.mockResolvedValue(undefined);
    writeFile.mockResolvedValue(undefined);
    unlink.mockResolvedValue(undefined);
    sweepStaleScanTempFiles.mockResolvedValue(undefined);
    findMany.mockResolvedValue([]);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns 400 when no photo is sent", async () => {
    const res = await POST(requestWithPhoto(null));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "noPhotoSent" });
  });

  it("returns 400 when the request body isn't parseable as form data at all", async () => {
    const req = new NextRequest("http://localhost/api/scan", {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=broken" },
      body: "not actually multipart content",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "noPhotoSent" });
  });

  it("returns 400 when the photo exceeds the max size", async () => {
    const res = await POST(requestWithPhoto(fakePhoto(15 * 1024 * 1024 + 1)));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "photoTooLarge" });
  });

  it("returns 502 when the OCR service responds with an error status", async () => {
    (fetch as any).mockResolvedValue({ ok: false, json: async () => ({ text: "" }) });
    const res = await POST(requestWithPhoto(fakePhoto()));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "imageProcessingFailed" });
  });

  it("returns 502 when the OCR service's response body can't be parsed as JSON", async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => { throw new Error("bad json"); } });
    const res = await POST(requestWithPhoto(fakePhoto()));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "imageProcessingFailed" });
  });

  it("returns 502 when the OCR request throws (e.g. network/connection error)", async () => {
    (fetch as any).mockRejectedValue(new Error("connection refused"));
    const res = await POST(requestWithPhoto(fakePhoto()));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "imageProcessingFailed" });
  });

  it("always cleans up the temp file, even when the OCR call fails", async () => {
    (fetch as any).mockRejectedValue(new Error("boom"));
    await POST(requestWithPhoto(fakePhoto()));
    expect(unlink).toHaveBeenCalledOnce();
  });

  it("defaults extractedText to '' when the OCR response has no text field", async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({}) });
    const res = await POST(requestWithPhoto(fakePhoto()));
    expect((await res.json()).extractedText).toBe("");
  });

  it("returns ranked candidates on success", async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ text: "Monkey.D.Luffy" }) });
    findMany.mockResolvedValue([
      {
        cardImageId: "OP01-001",
        cardSetId: "OP01-001",
        cardName: "Monkey.D.Luffy",
        cardType: "Leader",
        rarity: "L",
        isParallel: false,
        sourceType: "booster",
        localImagePath: null,
      },
    ]);
    const res = await POST(requestWithPhoto(fakePhoto()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.extractedText).toBe("Monkey.D.Luffy");
    expect(body.candidates[0].cardImageId).toBe("OP01-001");
  });

  it("uses a .png extension for PNG photos", async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ text: "" }) });
    await POST(requestWithPhoto(fakePhoto(100, "image/png")));
    expect(writeFile.mock.calls[0][0]).toMatch(/\.png$/);
  });

  it("uses a .jpg extension for non-PNG photos", async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ text: "" }) });
    await POST(requestWithPhoto(fakePhoto(100, "image/jpeg")));
    expect(writeFile.mock.calls[0][0]).toMatch(/\.jpg$/);
  });

  it("kicks off the stale-file sweep on every request", async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ text: "" }) });
    await POST(requestWithPhoto(fakePhoto()));
    expect(sweepStaleScanTempFiles).toHaveBeenCalledOnce();
  });
});
