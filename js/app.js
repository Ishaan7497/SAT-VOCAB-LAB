/*
 * SAT Vocab Lab — UI layer.
 * Depends on js/data.js (BATCHES, PRIORITY, BLUEBOOK) and js/core.js (VocabCore).
 * Rendering is plain template strings into #view; one delegated click handler
 * routes every interaction through data-* attributes.
 */
(function () {
  'use strict';

  /* ---------- site settings ----------
   * Fill these in once the project is published; empty values are hidden. */
  const SITE = {
    author: 'Ishaan Gupta',
    repoUrl: 'https://github.com/Ishaan7497/sat-vocab-lab',
  };

  const core = window.VocabCore;
  const { shuffle } = core;
  const deck = core.indexDeck(BATCHES);
  const { words: WORDS, byWord, batchById } = deck;

  const STORAGE = {
    mastery: 'satvocab:mastery',
    apiKey: 'satvocab:apikey',
    theme: 'satvocab:theme',
  };

  /* ---------- state ---------- */
  const state = {
    mode: 'batches',
    scope: 'all',          // 'all' or a batch id
    mastery: {},           // word -> 'known' | 'learning'
    query: '',
    cards: { order: null, pos: 0, flipped: false, onlyLearning: false },
    quiz: null,
    match: null,
    write: null,
    writeScore: { right: 0, total: 0 },
  };

  /* ---------- helpers ---------- */
  const $ = (sel) => document.querySelector(sel);
  const view = $('#view');
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const pct = (n, d) => (d ? (n / d) * 100 : 0);

  const store = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) {
      try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* storage blocked */ }
    },
  };

  function loadMastery() {
    try { state.mastery = JSON.parse(store.get(STORAGE.mastery)) || {}; } catch { state.mastery = {}; }
  }
  function setMastery(word, value) {
    if (state.mastery[word] === value) return;
    state.mastery[word] = value;
    store.set(STORAGE.mastery, JSON.stringify(state.mastery));
  }

  const inScope = () => (state.scope === 'all' ? WORDS : batchById[state.scope].words);

  function setScope(id) {
    state.scope = id;
    state.cards = { ...state.cards, order: null, pos: 0, flipped: false };
    state.quiz = state.match = state.write = null;
  }

  function meter(list) {
    const p = core.progress(list, state.mastery);
    return {
      ...p,
      html: `<div class="meter" role="img" aria-label="${p.known} known, ${p.learning} learning of ${p.total}">
        <i class="k" style="width:${pct(p.known, p.total)}%"></i><i class="l" style="width:${pct(p.learning, p.total)}%"></i></div>`,
    };
  }

  /* ---------- theme ---------- */
  const THEMES = ['auto', 'light', 'dark'];
  function applyTheme(theme) {
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    const btn = $('#theme');
    if (btn) {
      btn.textContent = { auto: 'Auto', light: 'Light', dark: 'Dark' }[theme];
      btn.setAttribute('aria-label', `Colour theme: ${theme}. Click to change.`);
    }
  }
  function cycleTheme() {
    const next = THEMES[(THEMES.indexOf(store.get(STORAGE.theme) || 'auto') + 1) % THEMES.length];
    store.set(STORAGE.theme, next === 'auto' ? null : next);
    applyTheme(next);
  }

  /* ---------- scope bar ---------- */
  function renderScope() {
    const bar = $('#scopebar');
    if (state.mode === 'batches' || state.mode === 'about' || state.scope === 'all') {
      bar.innerHTML = '';
      return;
    }
    const b = batchById[state.scope];
    bar.innerHTML = `<span class="scope">Batch ${b.n} · ${esc(b.name)}
        <button data-act="clearscope" aria-label="Clear batch filter and study all words">✕</button></span>
      <span class="mono">${inScope().length} words in scope</span>`;
  }

  /* ---------- batches (home) ---------- */
  function renderBatches() {
    const q = state.query.trim().toLowerCase();
    const hits = q.length > 1
      ? WORDS.filter((w) => w.w.toLowerCase().includes(q) || w.def.toLowerCase().includes(q)).slice(0, 12)
      : [];
    const all = meter(WORDS);
    view.innerHTML = `
      <label class="sr-only" for="q">Search words and definitions</label>
      <input class="search" id="q" placeholder="Find a word or a meaning…" value="${esc(state.query)}" autocomplete="off">
      <div id="hits">${hits.map((w) => `<button class="hit" data-jump="${esc(w.w)}"><b>${esc(w.w)}</b>
        <span>${esc(w.gist)} · batch ${batchById[w.b].n}</span></button>`).join('')}</div>
      <div class="overview">
        <div><b>${all.known}</b><span class="mono">known</span></div>
        <div><b>${all.learning}</b><span class="mono">learning</span></div>
        <div><b>${all.total - all.known - all.learning}</b><span class="mono">not started</span></div>
      </div>
      <p class="lede">Each batch is one sitting of about ten words, split into two opposing halves. Learn the pair, not the word: Words in Context questions turn on which way a sentence leans, not on a definition in isolation.</p>
      <div class="grid">${BATCHES.map((b) => {
        const m = meter(b.words);
        return `<button class="bcard${state.scope === b.id ? ' active' : ''}" data-batch="${b.id}">
          <span class="mono">Batch ${b.n} · ${m.total} words</span>
          <h4>${esc(b.name)}</h4>
          <span class="poles">${b.poles ? `${esc(b.poles[0])} ↔ ${esc(b.poles[1])}` : '&nbsp;'}</span>
          ${m.html}
          <span class="mono">${m.known} known · ${m.learning} learning</span>
        </button>`;
      }).join('')}</div>
      <div class="row" style="margin-top:18px">
        <button class="btn ghost" data-act="allscope">Study all ${WORDS.length} words</button>
        <button class="btn ghost small" data-act="reset">Reset all progress</button>
      </div>`;

    $('#q').addEventListener('input', (e) => {
      state.query = e.target.value;
      const caret = e.target.selectionStart;
      renderBatches();
      const input = $('#q');
      input.focus();
      input.setSelectionRange(caret, caret);
    });
  }

  /* ---------- flashcards ---------- */
  function cardDeck() {
    const list = inScope();
    const c = state.cards;
    if (!c.order || c.order.length !== list.length) c.order = list.map((_, i) => i);
    const ordered = c.order.map((i) => list[i]);
    const filtered = c.onlyLearning ? ordered.filter((w) => state.mastery[w.w] !== 'known') : ordered;
    return filtered.length ? filtered : ordered;
  }

  function chips(list, kind) {
    return list.map((s) => {
      const hit = byWord[s.toLowerCase()];
      return hit
        ? `<button class="chip ${kind} indeck" data-jump="${esc(s)}">${esc(s)}</button>`
        : `<span class="chip ${kind}">${esc(s)}</span>`;
    }).join('');
  }

  function renderCards() {
    const d = cardDeck();
    const c = state.cards;
    if (c.pos >= d.length) c.pos = 0;
    const w = d[c.pos];
    const b = batchById[w.b];
    const m = meter(inScope());
    view.innerHTML = `
      <div class="row spread" style="margin-bottom:4px">
        <span class="mono">Card ${c.pos + 1} / ${d.length}</span>
        <div class="row">
          <button class="btn ghost" data-act="shuffle">Shuffle</button>
          <button class="btn ghost" data-act="filter" aria-pressed="${c.onlyLearning}">${c.onlyLearning ? 'Show all' : 'Only still learning'}</button>
        </div>
      </div>
      <div class="stage"><div class="card${c.flipped ? ' flipped' : ''}" id="card" tabindex="0" role="button"
          aria-label="Flashcard: ${esc(w.w)}. ${c.flipped ? 'Showing definition.' : 'Press space to flip.'}">
        <div class="face front" aria-hidden="${c.flipped}">
          <div class="tag"><span class="mono">Batch ${b.n} · ${esc(b.poles ? b.poles[w.p - 1] : b.name)}</span>
            <span class="mono">${state.mastery[w.w] || 'new'}</span></div>
          <div class="headword">${esc(w.w)}</div><div class="pos">${esc(w.pos)}</div>
          <div class="hint mono">Click, or press space, to flip</div>
        </div>
        <div class="face back" aria-hidden="${!c.flipped}">
          <div class="tag"><span class="mono">${esc(w.w)}</span><span class="mono">${esc(w.pos)}</span></div>
          <p class="def">${esc(w.def)}</p>
          <p class="ex">${w.ex}</p>
          <div class="block"><span class="mono">Synonyms</span><div class="chips">${chips(w.syn, 'syn')}</div></div>
          <div class="block"><span class="mono">Antonyms</span><div class="chips">${chips(w.ant, 'ant')}</div></div>
          <div class="mono faint" style="margin-top:12px">Solid chips are in the deck — click to jump</div>
        </div>
      </div></div>
      <div class="row spread">
        <div class="row">
          <button class="btn ghost" data-act="prev" aria-label="Previous card">←</button>
          <button class="btn ghost" data-act="next" aria-label="Next card">→</button>
        </div>
        <div class="row">
          <button class="btn learn" data-act="learning">Still learning <kbd>1</kbd></button>
          <button class="btn know" data-act="known">Got it <kbd>2</kbd></button>
        </div>
      </div>
      ${m.html}
      <span class="mono">${m.known} known · ${m.learning} learning · ${m.total - m.known - m.learning} not started${state.scope === 'all' ? '' : ' in this batch'}</span>`;
    sizeCard();
  }

  // Both faces are absolutely positioned for the flip, so size the card to the taller one.
  function sizeCard() {
    const card = $('#card');
    if (!card) return;
    let h = 0;
    card.querySelectorAll('.face').forEach((f) => {
      f.style.position = 'static';
      h = Math.max(h, f.offsetHeight);
      f.style.position = 'absolute';
    });
    card.style.height = `${Math.max(h, 330)}px`;
  }

  function flipCard() {
    const c = state.cards;
    c.flipped = !c.flipped;
    const card = $('#card');
    if (!card) return;
    card.classList.toggle('flipped', c.flipped);
    card.querySelector('.front').setAttribute('aria-hidden', String(c.flipped));
    card.querySelector('.back').setAttribute('aria-hidden', String(!c.flipped));
  }

  function stepCard(delta) {
    const n = cardDeck().length;
    state.cards.flipped = false;
    state.cards.pos = (state.cards.pos + delta + n) % n;
    renderCards();
  }

  function markCard(value) {
    const d = cardDeck();
    const c = state.cards;
    setMastery(d[c.pos].w, value);
    c.flipped = false;
    // In "only still learning" mode a card marked known leaves the deck,
    // so the next card slides into the current position.
    if (!(c.onlyLearning && value === 'known')) c.pos++;
    renderCards();
  }

  function jumpTo(word) {
    const w = byWord[word.toLowerCase()];
    if (!w) return;
    if (state.scope !== 'all' && w.b !== state.scope) setScope(w.b);
    state.cards.onlyLearning = false;
    state.cards.order = null;
    state.cards.pos = Math.max(0, cardDeck().findIndex((x) => x.w === w.w));
    state.cards.flipped = true;
    setMode('cards');
  }

  /* ---------- meaning groups ---------- */
  function groupPlate(b) {
    const list = (ws) => ws.map((w) => `<button class="gword" data-jump="${esc(w.w)}"><b>${esc(w.w)}</b>
      <span>${esc(w.gist)} — ${esc(w.def)}</span></button>`).join('');
    const one = b.words.filter((w) => w.p === 1);
    const two = b.words.filter((w) => w.p === 2);
    return `<section class="plate">
      <span class="mono">Batch ${b.n} · ${b.words.length} words</span>
      <h3>${esc(b.name)}</h3><p class="gloss">${esc(b.gloss)}</p>
      ${b.poles ? `<span class="polehead">${esc(b.poles[0])}</span>` : ''}${list(one)}
      ${b.poles && two.length ? `<span class="polehead two">${esc(b.poles[1])}</span>` : ''}${list(two)}
      <div class="row" style="margin-top:14px"><button class="btn ghost" data-batch="${b.id}">Study this batch</button></div>
    </section>`;
  }

  function renderGroups() {
    const list = state.scope === 'all' ? BATCHES : [batchById[state.scope]];
    const intro = state.scope === 'all'
      ? `<p class="lede">All ${BATCHES.length} clusters. Within each, the second half is the opposite of the first.</p>`
      : '';
    view.innerHTML = intro + list.map(groupPlate).join('');
  }

  /* ---------- fill in the blank ---------- */
  function startQuiz(list) {
    const source = list || shuffle(inScope()).slice(0, 10);
    state.quiz = { qs: source.map((w) => core.buildQuestion(w, deck)), i: 0, score: 0 };
    renderQuiz();
  }

  function renderQuiz() {
    const quiz = state.quiz;
    if (!quiz) return startQuiz();
    if (quiz.i >= quiz.qs.length) {
      const missed = quiz.qs.filter((q) => q.answered && q.answered !== q.w.w);
      quiz.missed = missed.map((q) => q.w);
      view.innerHTML = `<div class="plate"><span class="mono">Round complete</span>
        <h3>${quiz.score} of ${quiz.qs.length} correct</h3>
        <p class="gloss">${missed.length ? `Missed: ${missed.map((q) => esc(q.w.w)).join(', ')}` : 'Clean round.'}</p>
        <div class="row"><button class="btn" data-act="newquiz">New round</button>
        ${missed.length ? '<button class="btn ghost" data-act="drillmissed">Drill the missed words</button>' : ''}</div></div>`;
      return;
    }
    const q = quiz.qs[quiz.i];
    view.innerHTML = `
      <div class="row spread" style="margin-bottom:12px">
        <span class="mono">Question ${quiz.i + 1} / ${quiz.qs.length}</span><span class="mono">Score ${quiz.score}</span>
      </div>
      <p class="qstem">${core.blankSentence(q.w)}</p>
      <div id="opts" role="group" aria-label="Answer choices">${q.opts.map((o, i) =>
        `<button class="opt" data-pick="${esc(o.word)}"><span class="mono">${'ABCD'[i]}</span>${esc(o.show)}</button>`).join('')}</div>
      <div id="fb" aria-live="polite"></div>`;
  }

  function answerQuiz(pick) {
    const quiz = state.quiz;
    const q = quiz.qs[quiz.i];
    if (q.answered) return;
    q.answered = pick;
    const right = pick === q.w.w;
    if (right) quiz.score++;
    else setMastery(q.w.w, 'learning');
    document.querySelectorAll('.opt').forEach((b) => {
      b.disabled = true;
      if (b.dataset.pick === q.w.w) b.classList.add('right');
      else if (b.dataset.pick === pick) b.classList.add('wrong');
    });
    const chosen = byWord[pick.toLowerCase()];
    $('#fb').innerHTML = `<div class="feedback"><b>${right ? 'Correct.' : 'Not quite.'}</b>
        <b>${esc(q.w.w)}</b> (${esc(q.w.pos)}) means ${esc(q.w.def)}.
        ${!right && chosen ? `<span class="wrongnote"><b>${esc(chosen.w)}</b> means ${esc(chosen.def)}, which doesn’t fit here.</span>` : ''}</div>
      <button class="btn" data-act="nextq">${quiz.i + 1 >= quiz.qs.length ? 'See score' : 'Next question'}</button>`;
    $('#fb .btn').focus();
  }

  /* ---------- match ---------- */
  function startMatch(size) {
    const unmastered = inScope().filter((w) => state.mastery[w.w] !== 'known');
    const source = unmastered.length >= size ? unmastered : inScope();
    const picks = shuffle(source).slice(0, Math.min(size, source.length));
    state.match = { left: shuffle(picks), right: shuffle(picks), sel: null, done: [], tries: 0, size: picks.length };
    renderMatch();
  }

  function renderMatch() {
    const m = state.match;
    if (!m) return startMatch(6);
    const tile = (w, side) => {
      const done = m.done.includes(w.w);
      const selected = m.sel && m.sel.word === w.w && m.sel.side === side;
      return `<button class="tile${side === 'L' ? ' word' : ''}${done ? ' done' : ''}${selected ? ' sel' : ''}"
        data-side="${side}" data-w="${esc(w.w)}" ${done ? 'disabled' : ''} aria-pressed="${selected}">
        ${side === 'L' ? esc(w.w) : esc(w.gist)}</button>`;
    };
    const solved = m.done.length === m.size;
    view.innerHTML = `
      <div class="row spread" style="margin-bottom:12px">
        <span class="mono">${m.done.length} / ${m.size} paired · ${m.tries} attempts</span>
        <div class="row"><button class="btn ghost" data-act="match6">6 pairs</button><button class="btn ghost" data-act="match10">10 pairs</button></div>
      </div>
      <p class="lede">Pick a word, then its meaning.</p>
      <div class="match"><div>${m.left.map((w) => tile(w, 'L')).join('')}</div><div>${m.right.map((w) => tile(w, 'R')).join('')}</div></div>
      ${solved ? `<div class="plate" style="margin-top:14px"><span class="mono">Round complete</span>
        <h3>${m.size} pairs in ${m.tries} attempts</h3>
        <p class="gloss">${m.tries === m.size ? 'Perfect run.' : `A perfect run is ${m.size}.`}</p>
        <button class="btn" data-act="match${m.size}">Play again</button></div>` : ''}`;
  }

  function pickTile(side, word) {
    const m = state.match;
    if (m.done.includes(word)) return;
    if (!m.sel || m.sel.side === side) {
      m.sel = { side, word };
      return renderMatch();
    }
    const first = m.sel.word;
    m.tries++;
    m.sel = null;
    if (first === word) m.done.push(word);
    renderMatch();
    if (first !== word) {
      document.querySelectorAll(`.tile[data-w="${CSS.escape(word)}"], .tile[data-w="${CSS.escape(first)}"]`)
        .forEach((t) => { t.classList.add('miss'); setTimeout(() => t.classList.remove('miss'), 450); });
    }
  }

  /* ---------- write a sentence ---------- */
  const CHECKER_MODEL = 'claude-haiku-5-5';
  const CHECKER_PROMPT = `You are a strict but encouraging SAT vocabulary tutor. The student gives you one target word and one sentence they wrote using it. Judge two things: (1) whether the sentence uses the word with its correct meaning and part of speech, and (2) whether the sentence is grammatical. Minor awkwardness is fine; a wrong meaning or wrong part of speech is not.
Respond with ONLY a JSON object, no markdown fences, no other text:
{"correct": true or false, "feedback": "two sentences max, specific to what they wrote, plain and direct"}`;

  function nextWriteWord() {
    state.write = { w: shuffle(inScope())[0], status: 'idle', text: '', verdict: '' };
  }

  function renderWrite() {
    if (!store.get(STORAGE.apiKey)) {
      view.innerHTML = `<div class="plate">
        <span class="mono">Write a sentence</span>
        <h3>Add an Anthropic API key to use this mode</h3>
        <p class="gloss">This mode sends your sentence to Claude for feedback. Paste a key from console.anthropic.com. It is stored only in this browser and sent only to Anthropic’s API. Every other tab works without a key.</p>
        <label class="sr-only" for="keyin">Anthropic API key</label>
        <input class="search" id="keyin" type="password" placeholder="sk-ant-…" autocomplete="off">
        <div class="row" style="margin-top:6px"><button class="btn" id="keysave">Save key</button></div>
      </div>`;
      $('#keysave').addEventListener('click', () => {
        const k = $('#keyin').value.trim();
        if (k) { store.set(STORAGE.apiKey, k); renderWrite(); }
      });
      return;
    }
    if (!state.write) nextWriteWord();
    const ws = state.write;
    const w = ws.w;
    const score = state.writeScore;
    view.innerHTML = `
      <div class="row spread" style="margin-bottom:10px">
        <span class="mono">Write your own sentence</span>
        <span class="mono">${score.right} / ${score.total} correct this session</span>
      </div>
      <div class="plate">
        <div class="wword">${esc(w.w)}</div>
        <p class="wdef">${esc(w.pos)} — ${esc(w.def)}</p>
        <label class="sr-only" for="wtext">Your sentence</label>
        <textarea class="warea" id="wtext" placeholder="Write a sentence that uses “${esc(w.w)}” correctly…">${esc(ws.text)}</textarea>
        <div class="row" style="margin-top:12px">
          <button class="btn" id="wsubmit" ${ws.status === 'checking' ? 'disabled' : ''}>Check my sentence</button>
          <button class="btn ghost" data-act="wskip">Another word</button>
          <button class="btn ghost small push" data-act="wforget">Remove API key</button>
        </div>
        <div id="wresult" aria-live="polite">${ws.status === 'checking'
          ? '<div class="wspin"><i></i>Reading your sentence…</div>' : ws.verdict}</div>
      </div>`;
    const ta = $('#wtext');
    ta.addEventListener('input', (e) => { ws.text = e.target.value; });
    if (ws.status !== 'done') ta.focus();
    $('#wsubmit').addEventListener('click', checkSentence);
  }

  async function checkSentence() {
    const ws = state.write;
    const sentence = ws.text.trim();
    if (!sentence) return;
    ws.status = 'checking';
    renderWrite();
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': store.get(STORAGE.apiKey),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: CHECKER_MODEL,
          max_tokens: 400,
          system: CHECKER_PROMPT,
          messages: [{
            role: 'user',
            content: `Target word: "${ws.w.w}" (${ws.w.pos})\nDefinition: ${ws.w.def}\nStudent's sentence: "${sentence}"`,
          }],
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const text = (data.content || []).map((b) => b.text || '').join('').replace(/```(json)?/g, '').trim();
      const result = JSON.parse(text);
      state.writeScore.total++;
      if (result.correct) state.writeScore.right++;
      setMastery(ws.w.w, result.correct ? 'known' : 'learning');
      ws.verdict = `<div class="verdict ${result.correct ? 'pass' : 'fail'}">
          <span class="vlabel">${result.correct ? 'Correct usage' : 'Not quite'}</span>${esc(result.feedback)}</div>
        <button class="btn" data-act="wnext">Next word</button>`;
    } catch {
      ws.verdict = `<div class="verdict fail"><span class="vlabel">Couldn’t check that</span>
        The checker didn’t respond. Check your connection, and that the API key is valid and has credit, then try again.</div>`;
    }
    ws.status = 'done';
    renderWrite();
  }

  /* ---------- priority ---------- */
  function renderPriority() {
    const P = PRIORITY;
    const wordChips = (list) => list.map((x) => {
      const hit = byWord[x.toLowerCase()];
      return hit
        ? `<button class="pw" data-jump="${esc(x)}">${esc(x)}</button>`
        : `<span class="pw flat">${esc(x)}</span>`;
    }).join('');
    const defs = (list) => list.map((o) => `<div class="pdef"><b>${esc(o.w)}</b><span>${esc(o.d)}</span></div>`).join('');
    const deckGroupCount = P.deck.reduce((n, g) => n + g.w.length, 0);
    view.innerHTML = `
      <div class="pnote"><b>About the frequency list:</b> the counts come from 3-4-5 Tutoring’s published analysis of
        Bluebook practice tests 4–10 plus the Medium and Hard Question Bank items — how many times each word appeared in that
        sample. It is a careful third-party compilation, not an official College Board list, so read the counts as a strong
        signal rather than a prediction. The groupings further down are editorial.</div>

      <div class="psec"><span class="mono">Bluebook</span><h2>By frequency in official practice material</h2>
        <p>${BLUEBOOK.length} words, most frequent first. Every one is in the deck; click to open its card.</p></div>
      ${BLUEBOOK.map(([w, f]) => {
        const hit = byWord[w.toLowerCase()];
        return `<div class="bbrow"><span class="bbf">${f}×</span>
          ${hit ? `<button class="bbw" data-jump="${esc(w)}">${esc(w)}</button>` : `<span class="bbw">${esc(w)}</span>`}
          <span class="bbg">${hit ? esc(hit.gist) : ''}</span></div>`;
      }).join('')}

      <div class="psec"><span class="mono">By function</span><h2>Grouped by the job the word does</h2>
        <p>${deckGroupCount} deck words, grouped by what they do in a sentence, since that is what a Words in Context question turns on.</p></div>
      ${P.deck.map((g) => `<div class="pgrp"><p class="ptitle">${esc(g.t)}</p>${wordChips(g.w)}</div>`).join('')}

      <div class="psec"><span class="mono">Transitions</span><h2>Transition words</h2>
        <p>Transitions are a recurring question type on the digital SAT. They are learned by category: the question is which relationship links two sentences, not what the word means.</p></div>
      ${P.transitions.map((g) => `<div class="pgrp"><p class="ptitle">${esc(g.t)}</p><p class="pnotelil">${esc(g.note)}</p>${wordChips(g.w)}</div>`).join('')}

      <div class="psec"><span class="mono">Function verbs</span><h2>Words in “purpose” answer choices</h2>
        <p>These verbs fill the choices on “what is the function of the underlined sentence” questions. Each makes a precise claim about what a text is doing.</p></div>
      ${defs(P.functions)}

      <div class="psec"><span class="mono">Extra</span><h2>Academic words outside the deck</h2>
        <p>Common academic words at digital-SAT difficulty. A read-through is enough.</p></div>
      ${defs(P.extra)}

      <div class="psec"><span class="mono">Strategy</span><h2>In the exam</h2></div>
      <div class="plan">
        <h4>Words in Context</h4><p>Cover the choices, predict a word from the sentence, then pick the closest match. Predicting first is what protects you from the trap answer.</p>
        <h4>Transitions</h4><p>Read both sentences and name their relationship — contrast, cause, example, addition — before looking at the options.</p>
        <h4>The last few days</h4><p>Review what you already know and do timed Reading and Writing modules. New words learned the night before rarely stick; sleep does more.</p>
      </div>`;
  }

  /* ---------- about ---------- */
  function renderAbout() {
    const all = meter(WORDS);
    const links = WORDS.reduce((n, w) => n + [...w.syn, ...w.ant].filter((s) => byWord[s.toLowerCase()]).length, 0);
    view.innerHTML = `
      <section class="about">
        <h2>Why it works this way</h2>
        <p>The digital SAT tests vocabulary through Words in Context questions: a sentence with a blank and four choices. The most tempting wrong answers are often words from the right topic that point the wrong way — <i>mitigate</i> when the sentence needs <i>exacerbate</i>. So the deck is organised around direction, not the alphabet.</p>
        <ul>
          <li><b>Antonym-paired batches.</b> ${WORDS.length} words in ${BATCHES.length} themed batches. Each batch is split into two opposing halves, so a word is always studied next to the words it is most easily confused with.</li>
          <li><b>A connected deck.</b> ${links} synonym and antonym links point to other cards, so studying one word leads to its neighbours.</li>
          <li><b>Quiz distractors that test direction.</b> Wrong options are drawn from the word’s own opposite half first and inflected to match the sentence (<i>abated</i>, not <i>abate</i>). Synonyms are excluded, so every question has exactly one defensible answer.</li>
          <li><b>Evidence-weighted priorities.</b> The Priority tab ranks words by how often they appeared in official practice tests.</li>
        </ul>

        <h2>Modes</h2>
        <dl class="modes">
          <dt>Batches</dt><dd>Choose a sitting; it filters every other mode.</dd>
          <dt>Flashcards</dt><dd>Definition, example, and linked synonyms and antonyms.</dd>
          <dt>Meaning groups</dt><dd>Each batch laid out by its two halves.</dd>
          <dt>Fill in the blank</dt><dd>SAT-style sentence completion with tense-matched options.</dd>
          <dt>Match</dt><dd>Pair words with meanings, drawn from words not yet mastered.</dd>
          <dt>Write a sentence</dt><dd>Your own sentence, checked by Claude (needs an API key).</dd>
          <dt>Priority</dt><dd>Frequency-ranked words, transitions and function verbs.</dd>
        </dl>

        <h2>Keyboard</h2>
        <p class="keys"><kbd>Space</kbd> flip · <kbd>←</kbd> <kbd>→</kbd> move · <kbd>1</kbd> still learning · <kbd>2</kbd> got it</p>

        <h2>Your progress</h2>
        <p>${all.known} known and ${all.learning} learning, stored only in this browser. Nothing is sent anywhere except sentences you choose to check.</p>

        <p class="credits">Definitions and example sentences are original to this project. Frequency data: 3-4-5 Tutoring’s analysis of Bluebook practice tests.
          SAT and Bluebook are trademarks of the College Board, which is not affiliated with this project.
          ${SITE.repoUrl ? `<br><a href="${esc(SITE.repoUrl)}">Source code on GitHub</a>` : ''}</p>
      </section>`;
  }

  /* ---------- routing ---------- */
  const RENDER = {
    batches: renderBatches,
    cards: renderCards,
    groups: renderGroups,
    quiz: () => (state.quiz ? renderQuiz() : startQuiz()),
    match: () => (state.match ? renderMatch() : startMatch(6)),
    write: renderWrite,
    priority: renderPriority,
    about: renderAbout,
  };

  function render() {
    renderScope();
    RENDER[state.mode]();
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('nav [role="tab"]').forEach((t) => {
      const on = t.dataset.mode === mode;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    render();
  }

  const ACTIONS = {
    prev: () => stepCard(-1),
    next: () => stepCard(1),
    shuffle: () => {
      state.cards = { ...state.cards, order: shuffle(inScope().map((_, i) => i)), pos: 0, flipped: false };
      renderCards();
    },
    filter: () => {
      state.cards = { ...state.cards, onlyLearning: !state.cards.onlyLearning, pos: 0, flipped: false };
      renderCards();
    },
    known: () => markCard('known'),
    learning: () => markCard('learning'),
    reset: () => {
      if (!confirm('Clear all known and learning marks?')) return;
      state.mastery = {};
      store.set(STORAGE.mastery, null);
      render();
    },
    clearscope: () => { setScope('all'); render(); },
    allscope: () => { setScope('all'); setMode('cards'); },
    nextq: () => { state.quiz.i++; renderQuiz(); },
    newquiz: () => startQuiz(),
    drillmissed: () => startQuiz(shuffle(state.quiz.missed || [])),
    match6: () => startMatch(6),
    match10: () => startMatch(10),
    wskip: () => { nextWriteWord(); renderWrite(); },
    wnext: () => { nextWriteWord(); renderWrite(); },
    wforget: () => { store.set(STORAGE.apiKey, null); state.write = null; renderWrite(); },
  };

  document.querySelector('nav').addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (tab) setMode(tab.dataset.mode);
  });

  // Arrow keys move between tabs, per the WAI-ARIA tabs pattern.
  document.querySelector('nav').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabs = [...document.querySelectorAll('nav [role="tab"]')];
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    next.focus();
    setMode(next.dataset.mode);
    e.preventDefault();
  });

  document.addEventListener('click', (e) => {
    const t = e.target;
    const batch = t.closest('[data-batch]');
    if (batch) { setScope(batch.dataset.batch); return setMode('cards'); }
    const jump = t.closest('[data-jump]');
    if (jump) return jumpTo(jump.dataset.jump);
    if (t.closest('#card')) return flipCard();
    const pick = t.closest('[data-pick]');
    if (pick) return answerQuiz(pick.dataset.pick);
    const tile = t.closest('.tile');
    if (tile && !tile.disabled) return pickTile(tile.dataset.side, tile.dataset.w);
    const act = t.closest('[data-act]');
    if (act && ACTIONS[act.dataset.act]) ACTIONS[act.dataset.act]();
  });

  document.addEventListener('keydown', (e) => {
    if (state.mode !== 'cards' || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.target.closest && e.target.closest('nav')) return;
    if (e.key === ' ' || (e.key === 'Enter' && e.target.id === 'card')) { e.preventDefault(); flipCard(); }
    else if (e.key === 'ArrowRight') stepCard(1);
    else if (e.key === 'ArrowLeft') stepCard(-1);
    else if (e.key === '1') markCard('learning');
    else if (e.key === '2') markCard('known');
  });

  window.addEventListener('resize', () => { if (state.mode === 'cards') sizeCard(); });
  $('#theme').addEventListener('click', cycleTheme);

  /* ---------- boot ---------- */
  loadMastery();
  applyTheme(store.get(STORAGE.theme) || 'auto');
  $('#wcount').textContent = WORDS.length;
  $('#sub').textContent = `${BATCHES.length} batches · progress saves in this browser`;
  if (SITE.author) $('#byline').textContent = `Built by ${SITE.author}`;
  render();
})();
