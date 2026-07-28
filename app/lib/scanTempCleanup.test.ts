// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const readdir = vi.fn();
const stat = vi.fn();
const unlink = vi.fn();
vi.mock("node:fs/promises", () => ({
  default: {
    readdir: (...args: unknown[]) => readdir(...args),
    stat: (...args: unknown[]) => stat(...args),
    unlink: (...args: unknown[]) => unlink(...args),
  },
}));

import { sweepStaleScanTempFiles } from "./scanTempCleanup";

const TEN_MIN_MS = 10 * 60 * 1000;

describe("sweepStaleScanTempFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unlink.mockResolvedValue(undefined);
  });

  it("does nothing when the temp directory can't be read (e.g. doesn't exist yet)", async () => {
    readdir.mockRejectedValue(new Error("ENOENT"));
    await sweepStaleScanTempFiles();
    expect(unlink).not.toHaveBeenCalled();
  });

  it("deletes files older than the stale threshold and keeps fresh ones", async () => {
    const now = Date.now();
    readdir.mockResolvedValue(["stale.jpg", "fresh.jpg"]);
    stat.mockImplementation((filePath: string) => {
      if (filePath.includes("stale")) return Promise.resolve({ mtimeMs: now - TEN_MIN_MS - 1000 });
      return Promise.resolve({ mtimeMs: now - 1000 });
    });
    await sweepStaleScanTempFiles();
    expect(unlink).toHaveBeenCalledOnce();
    expect(unlink.mock.calls[0][0]).toContain("stale.jpg");
  });

  it("swallows a stat failure for one file without affecting the others", async () => {
    const now = Date.now();
    readdir.mockResolvedValue(["gone.jpg", "stale.jpg"]);
    stat.mockImplementation((filePath: string) => {
      if (filePath.includes("gone")) return Promise.reject(new Error("ENOENT"));
      return Promise.resolve({ mtimeMs: now - TEN_MIN_MS - 1000 });
    });
    await expect(sweepStaleScanTempFiles()).resolves.toBeUndefined();
    expect(unlink).toHaveBeenCalledOnce();
    expect(unlink.mock.calls[0][0]).toContain("stale.jpg");
  });

  it("swallows an unlink failure without throwing", async () => {
    const now = Date.now();
    readdir.mockResolvedValue(["stale.jpg"]);
    stat.mockResolvedValue({ mtimeMs: now - TEN_MIN_MS - 1000 });
    unlink.mockRejectedValue(new Error("already removed by another request"));
    await expect(sweepStaleScanTempFiles()).resolves.toBeUndefined();
  });
});
