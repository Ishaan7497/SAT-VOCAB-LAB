// Checks the word deck for the mistakes that are easy to make when adding words.
// Run: node scripts/validate.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src + '\n;globalThis.__d={BATCHES,PRIORITY,BLUEBOOK};', ctx);
const { BATCHES, PRIORITY, BLUEBOOK } = ctx.__d;

const errors = [];
const warnings = [];
const words = BATCHES.flatMap(b => b.words.map(w => ({ ...w, batch: b.id })));
const index = new Map(words.map(w => [w.w.toLowerCase(), w]));
const REQUIRED = ['w', 'pos', 'p', 'def', 'gist', 'ex', 'syn', 'ant'];

// batch ids unique
const ids = BATCHES.map(b => b.id);
ids.filter((id, i) => ids.indexOf(id) !== i).forEach(id => errors.push(`duplicate batch id: ${id}`));

// word-level checks
const seen = new Map();
for (const w of words) {
  const key = w.w.toLowerCase();
  if (seen.has(key)) errors.push(`duplicate word "${w.w}" in ${seen.get(key)} and ${w.batch}`);
  seen.set(key, w.batch);
  for (const f of REQUIRED) if (w[f] === undefined) errors.push(`"${w.w}" (${w.batch}) missing field: ${f}`);
  if (w.p !== 1 && w.p !== 2) errors.push(`"${w.w}" pole must be 1 or 2, got ${w.p}`);
  if (!/<b>.+?<\/b>/.test(w.ex || '')) errors.push(`"${w.w}" example has no <b>…</b>, so the quiz can't blank it`);
  if (!Array.isArray(w.syn) || !Array.isArray(w.ant)) errors.push(`"${w.w}" syn/ant must be arrays`);
}

// batch sizes
for (const b of BATCHES) {
  if (b.words.length < 5) warnings.push(`batch ${b.id} "${b.name}" has only ${b.words.length} words`);
  if (b.words.length > 13) warnings.push(`batch ${b.id} "${b.name}" has ${b.words.length} words; consider splitting`);
}

// priority + bluebook lists point at real words
for (const g of PRIORITY.deck) for (const w of g.w)
  if (!index.has(w.toLowerCase())) errors.push(`Priority group "${g.t}" lists "${w}", which is not in the deck`);
for (const [w] of BLUEBOOK)
  if (!index.has(w.toLowerCase())) warnings.push(`Bluebook word "${w}" is not in the deck`);

const links = words.reduce((n, w) => n + [...w.syn, ...w.ant].filter(s => index.has(s.toLowerCase())).length, 0);
console.log(`${words.length} words · ${BATCHES.length} batches · ${links} live synonym/antonym links`);
warnings.forEach(m => console.log('warn  ' + m));
errors.forEach(m => console.log('ERROR ' + m));
if (errors.length) { console.log(`\n${errors.length} error(s)`); process.exit(1); }
console.log('deck OK');
