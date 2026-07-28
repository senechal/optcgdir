// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const readFile = vi.fn();
vi.mock("node:fs/promises", () => ({
  default: { readFile: (...args: unknown[]) => readFile(...args) },
}));

import { GET } from "./route";

function req() {
  return new NextRequest("http://localhost/api/catalog-image/x");
}

describe("GET /api/catalog-image/[filename]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an empty filename", async () => {
    const res = await GET(req(), { params: { filename: "" } });
    expect(res.status).toBe(400);
  });

  it("rejects a filename attempting path traversal with '..'", async () => {
    const res = await GET(req(), { params: { filename: "../../etc/passwd" } });
    expect(res.status).toBe(400);
    expect(readFile).not.toHaveBeenCalled();
  });

  it("rejects a filename containing a path separator", async () => {
    const res = await GET(req(), { params: { filename: "sub/dir.png" } });
    expect(res.status).toBe(400);
    expect(readFile).not.toHaveBeenCalled();
  });

  it("serves a .png file with the image/png content type", async () => {
    readFile.mockResolvedValue(Buffer.from("fake-png-bytes"));
    const res = await GET(req(), { params: { filename: "OP01-001.png" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toContain("immutable");
  });

  it("serves any non-.png file as image/jpeg", async () => {
    readFile.mockResolvedValue(Buffer.from("fake-jpg-bytes"));
    const res = await GET(req(), { params: { filename: "OP01-001.jpg" } });
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it("returns 404 when the file doesn't exist on disk", async () => {
    readFile.mockRejectedValue(new Error("ENOENT"));
    const res = await GET(req(), { params: { filename: "missing.jpg" } });
    expect(res.status).toBe(404);
  });
});
