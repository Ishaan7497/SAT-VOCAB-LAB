/*
 * Pure logic for SAT Vocab Lab: no DOM access, so it runs in the browser and
 * in Node's test runner alike. The browser loads it as a plain script and gets
 * a global `VocabCore`; tests load it through node:vm.
 */
(function (root) {
  'use strict';

  /** Fisher–Yates shuffle. Returns a new array; `rng` is injectable for tests. */
  function shuffle(list, rng = Math.random) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- inflection ----------
   * The quiz blanks a word inside a real sentence, so every answer choice has
   * to appear in the form that sentence needs ("abated", not "abate").
   * English is irregular; these rules cover every verb in the deck, and the
   * small exception tables cover the doubled-consonant cases.
   */
  const IRREGULAR_PAST = {
    gainsay: 'gainsaid', outstrip: 'outstripped', propel: 'propelled',
    rebut: 'rebutted', beset: 'beset', spur: 'spurred',
    extol: 'extolled', demur: 'demurred',
  };
  const IRREGULAR_GERUND = {
    outstrip: 'outstripping', propel: 'propelling', rebut: 'rebutting', spur: 'spurring',
    extol: 'extolling', demur: 'demurring',
  };

  function pastTense(lemma) {
    if (IRREGULAR_PAST[lemma]) return IRREGULAR_PAST[lemma];
    if (/e$/.test(lemma)) return lemma + 'd';
    if (/[^aeiou]y$/.test(lemma)) return lemma.slice(0, -1) + 'ied';
    return lemma + 'ed';
  }

  function gerund(lemma) {
    if (IRREGULAR_GERUND[lemma]) return IRREGULAR_GERUND[lemma];
    if (/ie$/.test(lemma)) return lemma.slice(0, -2) + 'ying';
    if (/[^aeiou]e$/.test(lemma)) return lemma.slice(0, -1) + 'ing';
    return lemma + 'ing';
  }

  function thirdPerson(lemma) {
    if (/(s|x|z|ch|sh)$/.test(lemma)) return lemma + 'es';
    if (/[^aeiou]y$/.test(lemma)) return lemma.slice(0, -1) + 'ies';
    return lemma + 's';
  }

  /** Which form of `lemma` is `surface`? One of 'base' | 'past' | 'gerund' | 's'. */
  function formOf(lemma, surface) {
    const l = lemma.toLowerCase();
    const s = surface.toLowerCase();
    if (s === l) return 'base';
    if (s === pastTense(l)) return 'past';
    if (s === gerund(l)) return 'gerund';
    if (s === thirdPerson(l)) return 's';
    return 'base';
  }

  /** Put `lemma` into the given form. */
  function inflect(lemma, form) {
    const l = lemma.toLowerCase();
    if (form === 'past') return pastTense(l);
    if (form === 'gerund') return gerund(l);
    if (form === 's') return thirdPerson(l);
    return l;
  }

  /* ---------- deck ---------- */

  /** Flatten batches into one list, tagging each word with its batch id and number. */
  function indexDeck(batches) {
    const words = [];
    batches.forEach((b, i) => {
      b.n = String(i + 1).padStart(2, '0');
      b.words.forEach((w) => { w.b = b.id; words.push(w); });
    });
    return {
      words,
      byWord: Object.fromEntries(words.map((w) => [w.w.toLowerCase(), w])),
      batchById: Object.fromEntries(batches.map((b) => [b.id, b])),
    };
  }

  /** The exact surface form highlighted in a word's example sentence. */
  function answerForm(word) {
    const m = word.ex.match(/<b>(.*?)<\/b>/);
    return m ? m[1] : word.w;
  }

  /* ---------- fill-in-the-blank ----------
   * Distractors are drawn from the target's own topic, opposite pole first.
   * That makes the question turn on the sentence's direction ("ease" vs
   * "worsen") rather than its subject, which is how the SAT writes them.
   * Synonyms are excluded so there is always exactly one defensible answer.
   */
  function buildQuestion(word, deck, rng = Math.random) {
    const { words, byWord, batchById } = deck;
    const surface = answerForm(word);
    const form = formOf(word.w, surface);
    const partOfSpeech = (x) => x.pos.split(' ')[0];
    const target = word.w.toLowerCase();
    const synonyms = new Set(word.syn.map((s) => s.toLowerCase()));

    const isSynonym = (x) =>
      synonyms.has(x.w.toLowerCase()) ||
      x.syn.some((s) => s.toLowerCase() === target) ||
      x.gist.toLowerCase() === word.gist.toLowerCase();
    const usable = (x) => x.w !== word.w && !isSynonym(x);
    const samePos = (x) => partOfSpeech(x) === partOfSpeech(word);

    const batch = batchById[word.b];
    const tiers = [
      shuffle(batch.words.filter((x) => x.p !== word.p && usable(x) && samePos(x)), rng),
      word.ant.map((a) => byWord[a.toLowerCase()]).filter((x) => x && usable(x) && samePos(x)),
      shuffle(words.filter((x) => x.b !== word.b && usable(x) && samePos(x)), rng),
      shuffle(words.filter(usable), rng), // last resort for rare parts of speech
    ];

    const seen = new Set([target]);
    const distractors = [];
    for (const x of tiers.flat()) {
      if (distractors.length === 3) break;
      const k = x.w.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      distractors.push(x);
    }

    const options = shuffle([word, ...distractors], rng).map((o) => ({
      word: o.w,
      show: o.w === word.w ? surface : inflect(o.w, form),
    }));
    return { w: word, opts: options, answered: null };
  }

  /** Example sentence with the target replaced by a blank. */
  function blankSentence(word) {
    return word.ex.replace(/<b>.*?<\/b>/, '<u></u>');
  }

  /** Known / learning / total counts for a list of words. */
  function progress(list, mastery) {
    let known = 0;
    let learning = 0;
    for (const w of list) {
      if (mastery[w.w] === 'known') known++;
      else if (mastery[w.w] === 'learning') learning++;
    }
    return { known, learning, total: list.length };
  }

  const api = {
    shuffle, pastTense, gerund, thirdPerson, formOf, inflect,
    indexDeck, answerForm, buildQuestion, blankSentence, progress,
  };
  root.VocabCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
