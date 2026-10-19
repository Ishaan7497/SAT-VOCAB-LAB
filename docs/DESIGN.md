# Design notes

Decisions behind SAT Vocab Lab, and the trade-offs each one made.

## 1. Organise by direction, not by the alphabet

**Problem.** The digital SAT tests vocabulary only through Words in Context questions: one sentence, one blank, four choices. Knowing a definition is necessary but rarely enough. The tempting wrong answer is usually a word from the right topic that points the wrong way — *mitigate* where the sentence needs *exacerbate*.

**Decision.** Every word sits in a themed batch of about ten, and every batch is split into two opposing halves ("Lessen or ease" against "Grow or worsen"). Synonyms and antonyms are stored per word, and any that are themselves in the deck become links between cards.

**Trade-off.** Grouping by theme means a few words don't fit any cluster cleanly. Rather than force them into a theme they don't belong to, batch 26 is openly labelled as a set of loose ends.

## 2. Quiz distractors that test the right thing

A naive fill-in-the-blank picks three random wrong words. That makes questions easy for the wrong reason: the student eliminates options because they're off-topic, not because they understood the sentence.

`buildQuestion` in [`js/core.js`](../js/core.js) chooses distractors in priority order:

1. words from the **opposite half of the same batch**,
2. the target's listed **antonyms**,
3. other words with the **same part of speech**,
4. anything else, as a last resort for rare parts of speech (the one phrase in the deck, *to this end*).

It then removes anything that is a listed synonym, lists the target as a synonym, or shares its short gloss, so each question has exactly one defensible answer.

### Inflection

Example sentences use real forms ("the downpour *abated*"), so every option must match: *abated, augmented, exacerbated*, not *abate, augment, exacerbate*. Mismatched forms are a giveaway. `formOf` detects which form the sentence uses (base, past, gerund, third person) and `inflect` applies it to each distractor.

English is irregular, so the rules carry a small exception table for doubled consonants (*propel → propelled*). The test suite checks that every one of the 349 example sentences uses a form the rules can reproduce. That test caught two real bugs — *extol* and *demur* — which had been showing their quiz options in the wrong tense.

## 3. No build step, no backend

The site is three plain scripts and a stylesheet. It opens from the file system, deploys to GitHub Pages as-is, and works offline. Fonts are self-hosted for the same reason.

The cost is that the browser and the tests have to share code without a module system. `js/core.js` attaches one global, `VocabCore`, and holds all logic that doesn't touch the page. Tests load the same files through `node:vm`, so they exercise exactly what the browser runs.

## 4. Privacy

Progress lives in the browser's `localStorage` and never leaves the device. The site makes no network requests of its own: no account, no analytics, and fonts are self-hosted.

## 5. Data integrity

The deck is ~115 KB of hand-written entries, which makes small mistakes easy: a duplicate word, a missing field, an example sentence without the `<b>` tag the quiz blanks. [`scripts/validate.mjs`](../scripts/validate.mjs) checks for all of these and runs on every push, alongside the unit tests.

## 6. Interface

- **Typography:** Fraunces for headwords (a word should look like a dictionary entry), Karla for reading, IBM Plex Mono for labels and counts.
- **Colour carries meaning consistently:** teal for synonyms, known words and correct answers; berry for antonyms and wrong answers; ochre for "still learning" and the current filter.
- **Dark mode** follows the system setting, with a manual override.
- **Accessibility:** tabs follow the WAI-ARIA tabs pattern (arrow keys move between modes), feedback regions are announced to screen readers, the flashcard hides its off-screen face from assistive technology, and motion is reduced when the system asks for it.

## What I'd do next

- **Spaced repetition.** "Still learning" currently only filters. Storing when each word was last seen would let the app bring words back on a schedule.
- **A second sentence per word.** The quiz reuses the flashcard sentence, so a drilled batch becomes recognisable. A held-out test sentence would make the quiz a cleaner measure.
- **Measure whether the pairing helps.** The design rests on a hypothesis — that learning words against their opposites improves Words in Context accuracy. A small comparison against an alphabetical deck would test it.
