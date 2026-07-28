// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirst = vi.fn();
const create = vi.fn();
vi.mock("./prisma", () => ({
  prisma: { user: { findFirst: (...args: unknown[]) => findFirst(...args), create: (...args: unknown[]) => create(...args) } },
}));

describe("getDefaultUserId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns the id of the existing default user without creating one", async () => {
    findFirst.mockResolvedValue({ id: "existing-user" });
    const { getDefaultUserId } = await import("./currentUser");
    expect(await getDefaultUserId()).toBe("existing-user");
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a default user when none exists yet", async () => {
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({ id: "new-user" });
    const { getDefaultUserId } = await import("./currentUser");
    expect(await getDefaultUserId()).toBe("new-user");
    expect(create).toHaveBeenCalledWith({ data: { username: "default", passwordHash: "no-auth-yet" } });
  });

  it("caches the id after the first call, skipping Prisma on subsequent calls", async () => {
    findFirst.mockResolvedValue({ id: "existing-user" });
    const { getDefaultUserId } = await import("./currentUser");
    await getDefaultUserId();
    findFirst.mockClear();
    const second = await getDefaultUserId();
    expect(second).toBe("existing-user");
    expect(findFirst).not.toHaveBeenCalled();
  });
});
