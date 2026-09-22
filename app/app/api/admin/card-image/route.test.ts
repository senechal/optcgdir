// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const findUnique = vi.fn();
const update = vi.fn().mockResolvedValue({});
vi.mock("../../../../lib/prisma", () => ({
  prisma: {
    card: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

const mkdir = vi.fn().mockResolvedValue(undefined);
const writeFile = vi.fn().mockResolvedValue(undefined);
vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: (...args: unknown[]) => mkdir(...args),
    writeFile: (...args: unknown[]) => writeFile(...args),
  },
}));

import { POST } from "./route";

const CARD_ID = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

function requestWithForm(fields: Record<string, string | File>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return new NextRequest("http://localhost/api/admin/card-image", { method: "POST", body: formData });
}

function fakeFile(size: number, name = "art.jpg", type = "image/jpeg") {
  return new File([new Uint8Array(size)], name, { type });
}

describe("POST /api/admin/card-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mkdir.mockResolvedValue(undefined);
    writeFile.mockResolvedValue(undefined);
    update.mockResolvedValue({});
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns 400 when cardId is missing", async () => {
    const res = await POST(requestWithForm({ file: fakeFile(10) }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the card doesn't exist", async () => {
    findUnique.mockResolvedValue(null);
    const res = await POST(requestWithForm({ cardId: CARD_ID, file: fakeFile(10) }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when neither a file nor a url is sent", async () => {
    findUnique.mockResolvedValue({ id: CARD_ID, cardImageId: "OP01-001" });
    const res = await POST(requestWithForm({ cardId: CARD_ID }));
    expect(res.status).toBe(400);
  });

  it("saves an uploaded file under a name exclusive to that card and updates localImagePath by id", async () => {
    findUnique.mockResolvedValue({ id: CARD_ID, cardImageId: "OP01-001" });
    const res = await POST(requestWithForm({ cardId: CARD_ID, file: fakeFile(100, "photo.png", "image/png") }));

    expect(res.status).toBe(200);
    expect(writeFile).toHaveBeenCalledOnce();
    const [writtenPath] = writeFile.mock.calls[0];
    const expectedName = `OP01-001__manual-${CARD_ID.slice(0, 10)}.png`;
    expect(writtenPath).toContain(expectedName);
    expect(update).toHaveBeenCalledWith({
      where: { id: CARD_ID },
      data: { localImagePath: expectedName },
    });
  });

  it("keeps the filename unique even when two cards share the same cardImageId (the bug this page fixes)", async () => {
    const otherId = "f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5";
    findUnique.mockResolvedValueOnce({ id: CARD_ID, cardImageId: "OP17-006" });
    await POST(requestWithForm({ cardId: CARD_ID, file: fakeFile(10) }));
    const [firstPath] = writeFile.mock.calls[0];

    findUnique.mockResolvedValueOnce({ id: otherId, cardImageId: "OP17-006" });
    await POST(requestWithForm({ cardId: otherId, file: fakeFile(10) }));
    const [secondPath] = writeFile.mock.calls[1];

    expect(firstPath).not.toBe(secondPath);
  });

  it("sanitizes characters unsafe for a filename out of the cardImageId", async () => {
    findUnique.mockResolvedValue({ id: CARD_ID, cardImageId: 'weird"name/here' });
    await POST(requestWithForm({ cardId: CARD_ID, file: fakeFile(10) }));
    const [writtenPath] = writeFile.mock.calls[0];
    expect(writtenPath).toContain(`weird_name_here__manual-${CARD_ID.slice(0, 10)}.jpg`);
  });

  it("rejects a file larger than 10MB", async () => {
    findUnique.mockResolvedValue({ id: CARD_ID, cardImageId: "OP01-001" });
    const res = await POST(requestWithForm({ cardId: CARD_ID, file: fakeFile(11 * 1024 * 1024) }));
    expect(res.status).toBe(400);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("rejects a malformed url", async () => {
    findUnique.mockResolvedValue({ id: CARD_ID, cardImageId: "OP01-001" });
    const res = await POST(requestWithForm({ cardId: CARD_ID, url: "not a url" }));
    expect(res.status).toBe(400);
  });

  it("rejects a non-http(s) url", async () => {
    findUnique.mockResolvedValue({ id: CARD_ID, cardImageId: "OP01-001" });
    const res = await POST(requestWithForm({ cardId: CARD_ID, url: "file:///etc/passwd" }));
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("downloads from a valid url and saves it under the card's exclusive filename", async () => {
    findUnique.mockResolvedValue({ id: CARD_ID, cardImageId: "OP01-001" });
    (fetch as any).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array(50).buffer,
      headers: new Headers({ "content-type": "image/png" }),
    });

    const res = await POST(requestWithForm({ cardId: CARD_ID, url: "https://example.com/art" }));

    expect(res.status).toBe(200);
    const [writtenPath] = writeFile.mock.calls[0];
    expect(writtenPath).toContain(`OP01-001__manual-${CARD_ID.slice(0, 10)}.png`);
  });

  it("returns 400 when the url download fails", async () => {
    findUnique.mockResolvedValue({ id: CARD_ID, cardImageId: "OP01-001" });
    (fetch as any).mockResolvedValue({ ok: false, status: 404 });
    const res = await POST(requestWithForm({ cardId: CARD_ID, url: "https://example.com/missing.jpg" }));
    expect(res.status).toBe(400);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("falls back to .jpg for a disallowed extension", async () => {
    findUnique.mockResolvedValue({ id: CARD_ID, cardImageId: "OP01-001" });
    const res = await POST(
      requestWithForm({ cardId: CARD_ID, file: fakeFile(10, "script.exe", "application/octet-stream") })
    );
    expect(res.status).toBe(200);
    const [writtenPath] = writeFile.mock.calls[0];
    expect(writtenPath).toContain(`OP01-001__manual-${CARD_ID.slice(0, 10)}.jpg`);
  });
});
