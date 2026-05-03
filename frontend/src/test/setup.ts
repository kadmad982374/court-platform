// Vitest global setup.
//
// jsdom 25 + Node 20 sometimes resolves `localStorage` to the host runtime's
// experimental Storage proxy (when NODE_OPTIONS / vitest worker flags trigger
// `--experimental-localstorage`). That proxy lacks `.clear()` / `.key()` /
// `.length`, which breaks tests that rely on the full Storage contract.
//
// Replace it with a deterministic in-memory implementation so every test starts
// from a clean slate and has access to the full Web Storage API. Cheap and
// scoped to tests — production bundle is unaffected.

import '@testing-library/jest-dom/vitest';

function createMemoryStorage(): Storage {
  let store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store = new Map();
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
  };
}

const memoryLocal = createMemoryStorage();
const memorySession = createMemoryStorage();

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: memoryLocal,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  writable: true,
  value: memorySession,
});

// Reset between tests so spec ordering can't leak state.
import { beforeEach } from 'vitest';
beforeEach(() => {
  memoryLocal.clear();
  memorySession.clear();
});
