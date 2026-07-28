import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Garante que cada teste comece com o DOM limpo — sem isso, elementos de
// um teste anterior continuam montados e podem colidir com queries de
// texto/valor do teste seguinte.
afterEach(() => {
  cleanup();
});

// jsdom não implementa IntersectionObserver (usado por CardImage.tsx pra
// lazy-load); um mock controlável por teste evita "ReferenceError" e deixa
// cada teste decidir quando simular a imagem entrando na viewport. Cada
// instância criada fica em `mockIntersectionObservers` pra o teste pegar
// a mais recente e chamar `.trigger(true)`.
export class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  private callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    mockIntersectionObservers.push(this);
  }

  observe = () => {};
  unobserve = () => {};
  disconnect = () => {};
  takeRecords = () => [];

  trigger(isIntersecting: boolean) {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this);
  }
}

export const mockIntersectionObservers: MockIntersectionObserver[] = [];

(globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
  MockIntersectionObserver as unknown as typeof IntersectionObserver;
