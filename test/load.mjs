// Loads the browser scripts into an isolated context so Node can test them
// exactly as the browser runs them, with no build step.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function load() {
  const ctx = { console };
  vm.createContext(ctx);
  for (const file of ['../js/data.js', '../js/core.js']) {
    vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), ctx, { filename: file });
  }
  vm.runInContext('globalThis.__out = { BATCHES, PRIORITY, BLUEBOOK };', ctx);
  return { ...ctx.__out, core: ctx.VocabCore };
}

/** Deterministic RNG so randomized tests are reproducible. */
export function seeded(seed = 42) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
