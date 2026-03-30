import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

class MockIntersectionObserver {
  observe() {}

  unobserve() {}

  disconnect() {}
}

vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(HTMLElement.prototype, "scrollTo", {
  configurable: true,
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(HTMLMediaElement.prototype, "pause", {
  configurable: true,
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(HTMLMediaElement.prototype, "load", {
  configurable: true,
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(HTMLMediaElement.prototype, "play", {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
  writable: true,
});

Object.defineProperty(HTMLMediaElement.prototype, "canPlayType", {
  configurable: true,
  value: vi.fn().mockReturnValue(""),
  writable: true,
});

const storage = new Map<string, string>();

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    clear() {
      storage.clear();
    },
    getItem(key: string) {
      return storage.has(key) ? storage.get(key)! : null;
    },
    key(index: number) {
      return Array.from(storage.keys())[index] ?? null;
    },
    removeItem(key: string) {
      storage.delete(key);
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
    get length() {
      return storage.size;
    },
  },
});
