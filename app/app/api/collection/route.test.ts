// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getDefaultUserId = vi.fn().mockResolvedValue("user-1");
vi.mock("../../../lib/currentUser", () => ({
  getDefaultUserId: () => getDefaultUserId(),
}));

const findFirst = vi.fn();
const update = vi.fn().mockResolvedValue({});
const create = vi.fn().mockResolvedValue({});
const del = vi.fn().mockResolvedValue({});
vi.mock("../../../lib/prisma", () => ({
  prisma: {
    collectionItem: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      update: (...args: unknown[]) => update(...args),
      create: (...args: unknown[]) => create(...args),
      delete: (...args: unknown[]) => del(...args),
    },
  },
}));

import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/collection", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/collection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDefaultUserId.mockResolvedValue("user-1");
  });

  it("returns 400 when cardImageId is missing", async () => {
    const res = await POST(request({ action: "increment" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when action is missing", async () => {
    const res = await POST(request({ cardImageId: "OP01-001" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the request body isn't valid JSON", async () => {
    const req = new NextRequest("http://localhost/api/collection", { method: "POST", body: "not json" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for an unrecognized action", async () => {
    findFirst.mockResolvedValue(null);
    const res = await POST(request({ cardImageId: "OP01-001", action: "explode" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "action inválida" });
  });

  it("increments the quantity of an existing collection item", async () => {
    findFirst.mockResolvedValue({ id: "item-1", quantity: 1, wantsTrade: false });
    const res = await POST(request({ cardImageId: "OP01-001", action: "increment" }));
    expect(update).toHaveBeenCalledWith({ where: { id: "item-1" }, data: { quantity: { increment: 1 } } });
    expect(res.status).toBe(200);
  });

  it("creates a new collection item with quantity 1 when incrementing a card not yet owned", async () => {
    findFirst.mockResolvedValue(null);
    await POST(request({ cardImageId: "OP01-001", action: "increment" }));
    expect(create).toHaveBeenCalledWith({ data: { cardImageId: "OP01-001", userId: "user-1", quantity: 1 } });
  });

  it("decrements the quantity when it's greater than 1", async () => {
    findFirst.mockResolvedValue({ id: "item-1", quantity: 3, wantsTrade: false });
    await POST(request({ cardImageId: "OP01-001", action: "decrement" }));
    expect(update).toHaveBeenCalledWith({ where: { id: "item-1" }, data: { quantity: { decrement: 1 } } });
    expect(del).not.toHaveBeenCalled();
  });

  it("deletes the collection item when decrementing from quantity 1", async () => {
    findFirst.mockResolvedValue({ id: "item-1", quantity: 1, wantsTrade: false });
    await POST(request({ cardImageId: "OP01-001", action: "decrement" }));
    expect(del).toHaveBeenCalledWith({ where: { id: "item-1" } });
  });

  it("silently no-ops when decrementing a card that isn't owned", async () => {
    findFirst.mockResolvedValue(null);
    const res = await POST(request({ cardImageId: "OP01-001", action: "decrement" }));
    expect(update).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("toggles wantsTrade to true on an existing item that didn't want trade", async () => {
    findFirst.mockResolvedValue({ id: "item-1", quantity: 1, wantsTrade: false });
    await POST(request({ cardImageId: "OP01-001", action: "toggleWantsTrade" }));
    expect(update).toHaveBeenCalledWith({ where: { id: "item-1" }, data: { wantsTrade: true } });
  });

  it("toggles wantsTrade to false on an existing item that wanted trade", async () => {
    findFirst.mockResolvedValue({ id: "item-1", quantity: 1, wantsTrade: true });
    await POST(request({ cardImageId: "OP01-001", action: "toggleWantsTrade" }));
    expect(update).toHaveBeenCalledWith({ where: { id: "item-1" }, data: { wantsTrade: false } });
  });

  it("creates a zero-quantity wantsTrade item when toggling a card not yet owned", async () => {
    findFirst.mockResolvedValue(null);
    await POST(request({ cardImageId: "OP01-001", action: "toggleWantsTrade" }));
    expect(create).toHaveBeenCalledWith({ data: { cardImageId: "OP01-001", userId: "user-1", quantity: 0, wantsTrade: true } });
  });
});
