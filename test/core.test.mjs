import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, seeded } from './load.mjs';

const { BATCHES, core } = load();
const deck = core.indexDeck(BATCHES);

test('inflection: regular, -e, consonant+y, and doubled-consonant verbs', () => {
  assert.equal(core.pastTense('abate'), 'abated');
  assert.equal(core.pastTense('curtail'), 'curtailed');
  assert.equal(core.pastTense('deny'), 'denied');
  assert.equal(core.pastTense('propel'), 'propelled');
  assert.equal(core.pastTense('gainsay'), 'gainsaid');
  assert.equal(core.pastTense('extol'), 'extolled');
  assert.equal(core.gerund('mitigate'), 'mitigating');
  assert.equal(core.gerund('outstrip'), 'outstripping');
  assert.equal(core.thirdPerson('accentuate'), 'accentuates');
  assert.equal(core.thirdPerson('abolish'), 'abolishes');
});

test('formOf recognises each surface form and round-trips through inflect', () => {
  for (const [lemma, form] of [['abate', 'past'], ['mitigate', 'gerund'], ['attest', 's'], ['laud', 'base']]) {
    const surface = core.inflect(lemma, form);
    assert.equal(core.formOf(lemma, surface), form, `${lemma} -> ${surface}`);
  }
});

test('every example sentence highlights a form the quiz can recognise', () => {
  for (const w of deck.words) {
    const surface = core.answerForm(w);
    const form = core.formOf(w.w, surface);
    assert.equal(core.inflect(w.w, form), surface.toLowerCase(), `"${w.w}" highlights "${surface}"`);
  }
});

test('every word yields a question with four distinct options and one correct answer', () => {
  const rng = seeded(7);
  for (const w of deck.words) {
    const q = core.buildQuestion(w, deck, rng);
    assert.equal(q.opts.length, 4, w.w);
    assert.equal(new Set(q.opts.map((o) => o.word)).size, 4, `${w.w}: duplicate options`);
    assert.equal(q.opts.filter((o) => o.word === w.w).length, 1, w.w);
  }
});

test('no distractor is a listed synonym of the answer', () => {
  const rng = seeded(11);
  for (const w of deck.words) {
    const syn = new Set(w.syn.map((s) => s.toLowerCase()));
    for (const o of core.buildQuestion(w, deck, rng).opts) {
      if (o.word !== w.w) assert.ok(!syn.has(o.word.toLowerCase()), `${w.w} offered synonym ${o.word}`);
    }
  }
});

test('distractors are inflected to match the blank', () => {
  const abate = deck.byWord['abate']; // example uses "abated"
  const q = core.buildQuestion(abate, deck, seeded(3));
  for (const o of q.opts) assert.match(o.show, /ed$/, `${o.word} shown as ${o.show}`);
});

test('distractors prefer the opposite pole of the same batch', () => {
  const abate = deck.byWord['abate'];
  const batch = deck.batchById[abate.b];
  const opposite = new Set(batch.words.filter((x) => x.p !== abate.p).map((x) => x.w));
  const q = core.buildQuestion(abate, deck, seeded(5));
  const distractors = q.opts.filter((o) => o.word !== abate.w);
  assert.ok(distractors.every((o) => opposite.has(o.word)), distractors.map((o) => o.word).join(', '));
});

test('blankSentence removes the target word', () => {
  const w = deck.byWord['laud'];
  const blanked = core.blankSentence(w);
  assert.ok(!blanked.includes('<b>'));
  assert.ok(blanked.includes('<u></u>'));
});

test('shuffle keeps every element and does not mutate its input', () => {
  const input = [1, 2, 3, 4, 5, 6];
  const out = core.shuffle(input, seeded(1));
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(Array.from(out).sort(), input);
});

test('progress counts known and learning words', () => {
  const list = [{ w: 'a' }, { w: 'b' }, { w: 'c' }];
  const p = core.progress(list, { a: 'known', b: 'learning' });
  assert.deepEqual([p.known, p.learning, p.total], [1, 1, 3]);
});
