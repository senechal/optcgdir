import { describe, it, expect } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import CardImage from "./CardImage";
import { mockIntersectionObservers } from "../vitest.setup";

function triggerLastObserver(isIntersecting: boolean) {
  act(() => {
    mockIntersectionObservers.at(-1)!.trigger(isIntersecting);
  });
}

describe("CardImage", () => {
  it("shows only the shimmer placeholder before the image enters the viewport", () => {
    const { container } = render(<CardImage src="/foo.jpg" alt="Foo" />);
    expect(container.querySelector(".card-shimmer")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("renders the image once IntersectionObserver reports it's visible", () => {
    render(<CardImage src="/foo.jpg" alt="Foo card" />);
    triggerLastObserver(true);
    expect(screen.getByAltText("Foo card")).toBeInTheDocument();
  });

  it("keeps the shimmer visible (opacity 0 on the image) until onLoad fires", () => {
    render(<CardImage src="/foo.jpg" alt="Loading card" />);
    triggerLastObserver(true);
    const img = screen.getByAltText("Loading card") as HTMLImageElement;
    expect(img.style.opacity).toBe("0");
  });

  it("fades the image in and hides the shimmer after onLoad fires", async () => {
    const { container } = render(<CardImage src="/foo.jpg" alt="Loaded card" />);
    triggerLastObserver(true);
    const img = screen.getByAltText("Loaded card") as HTMLImageElement;
    // next/image resolves loading via img.decode().then(...) internally
    // (see image-component.js) instead of relying on the raw "load" event
    // synchronously, so the opacity flip happens a microtask after dispatch.
    act(() => {
      img.dispatchEvent(new Event("load"));
    });
    await waitFor(() => expect(img.style.opacity).toBe("1"));
    expect(container.querySelector(".card-shimmer")).not.toBeInTheDocument();
  });

  it("defaults to cover object-fit and the default sizes string", () => {
    render(<CardImage src="/foo.jpg" alt="Defaults" />);
    triggerLastObserver(true);
    const img = screen.getByAltText("Defaults") as HTMLImageElement;
    expect(img.style.objectFit).toBe("cover");
    expect(img.getAttribute("sizes")).toContain("45vw");
  });

  it("accepts an explicit objectFit and sizes override (used by the enlarge modal)", () => {
    render(<CardImage src="/foo.jpg" alt="Contain" objectFit="contain" sizes="100vw" />);
    triggerLastObserver(true);
    const img = screen.getByAltText("Contain") as HTMLImageElement;
    expect(img.style.objectFit).toBe("contain");
    expect(img.getAttribute("sizes")).toBe("100vw");
  });

  it("ignores a non-intersecting entry and keeps showing only the shimmer", () => {
    const { container } = render(<CardImage src="/foo.jpg" alt="Not yet" />);
    triggerLastObserver(false);
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });
});
