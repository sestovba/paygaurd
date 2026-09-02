# PayGuard — brand, voice and design system

**Global, then local.** Everything in Part 1 is true on every screen and is not
a layout's to change. Part 2 is what a layout *may* change, and the exact list
of what it may not.

This file owns **words and voice**. It is the written half of
`src/domain/copy.ts`, which is the executable half — the type there enforces
what the tables here describe, so if the two disagree, the code is right and
this file is stale. Craft rules for pixels (alignment, flat structure,
reversibility) stay in [`WORKING-WITH-SERGEY.md`](WORKING-WITH-SERGEY.md) §4;
the audience constraints and the device constraints stay in
[`CLAUDE.md`](../CLAUDE.md). Nothing is repeated across those three — a rule
lives in exactly one of them.

---

# 0 · The brand, in four sentences

**PayGuard tells a disabled person on SSDI how much they can work this month
without losing their benefits.**

- The user is on SSDI or SSI. Low income, often a cheap Android with an old
  WebView, frequently doing gig work, frequently reading this while worried
  about money. That is the whole audience. There is no second one.
- The promise is **a decision, not a report**: "you can work about five more
  hours" beats any chart of what already happened.
- The tone is **a competent friend who has read the rules for you**. Not a
  government form, not a bank, not a coach, not a cheerleader.
- What it refuses: explaining Social Security's opinions, long paragraphs,
  abbreviations, fake balances, and any number that looks more certain than
  it is.

---

# PART 1 · GLOBAL

Every screen. Not negotiable by a layout.

## 1.1 The master vocabulary

One key, one meaning. The key set is fixed — `Vocabulary` in
`src/domain/copy.ts` — and every tone must answer every key. A layout cannot
drop a label, invent one, or leave a gap.

| Concept | Master wording | Never called |
|---|---|---|
| The list of things that pay you | **Income** | Sources, Streams, Earnings |
| One of them | **Job** | Source, Stream |
| A wage job | **A job that pays me** | W-2, W-2 employee |
| Self-employment | **Work I do for myself** | 1099, 1099 contract, SE |
| The monthly amount not to cross | **Your limit** | SGA, TWP, threshold |
| The figure the app aims at | **What we aim for** | Buffer, target, safe zone |
| Money that counts against the limit | **Counted** | Countable, countable income |
| Pay before deductions | **Pay before taxes** | Gross, earnings, amount |
| What landed in the bank | **Money that reached your bank** | Net, take-home |
| Gig pay, before miles come off | **Money they paid you** | Gross receipts, 1099 income |
| Hours worked | **Hours you worked** | hrs, h/wk, work hours |
| Business miles | **Miles you drove for work** | mi, mileage, business miles |
| The nine months | **Trial work months** | TWP, Trial Work Period |
| A month with an extra paycheck | **Months that pay you extra** | 3-/5-paycheck months, heavy months |
| How sure a figure is | **How sure this is** | Confidence score, data quality |

The two chips for where money comes from are **Employer** and **Gig work**
(`SOURCE_SHORT`); the two full choices when someone is picking are **A job
that pays me** and **Delivery or gig work** (`SOURCE_CHOICE`). A driver who
does not know they are "1099" must still pick the right door, because the
mileage deduction only exists behind one of them.

## 1.2 The four questions every label answers

Most of what the content audit found was not a bad word — it was a missing
one. A label that leaves any of these to be guessed at is a place someone can
enter the wrong number and never find out.

| | The question | The failure it prevents |
|---|---|---|
| 1 | **Which number?** | "Earned", "Amount", "Total", "Pay" — before tax or after? These differ by hundreds against a limit measured in hundreds. |
| 2 | **Which period?** | "Total", "so far", "YTD" were each used for this month, this year, and since-you-started. |
| 3 | **Of what?** | "$162 left" — of the safety target, or of the limit? "Room" and "left" never travel alone. |
| 4 | **So what?** | "Over your limit" is a fact. "Earning this much can stop your monthly payments" is the fact *and* the stake. |

## 1.3 The anti-vocabulary

Kept as data in `NEVER` (`src/domain/copy.ts`) so it can be checked rather
than believed. Three of these can cost the reader money; the rest cost them
the thread.

`TWP` · `SGA` · `Substantial Gainful Activity` · `Trial Work Period` · `YTD` ·
`IRWE` · `Gross` · `Net` · `Countable` · `Earned` · `Amount` · `Room` · `hrs`
· `mi` · `on track` · `on course` · `burn` · `runway`

Two rules behind the list:

- **No abbreviations on screen, including units.** A unit is the last word to
  shorten — it is the word saying what the number *is*.
- **One limit at a time.** Name the limit that applies and never the one that
  does not. In the trial work period the substantial-work limit is not
  mentioned; once the nine months are spent, trial work months are never
  mentioned again. Everywhere else it is "your limit" — unambiguous *because*
  the reader is never shown the other one.

## 1.4 Sentence patterns

- **Ask a question, do not name a field.** "How much did they pay you?" not
  "Gross earnings". A label names a database column; a question tells you what
  to do.
- **Describe the thing, do not assume the word.** "the paper or email your job
  sends you when they pay you", not "paystub".
- **One idea per sentence, and short ones.** Two rules are two sentences.
- **Say what will happen, before it happens.** "If you type one total here,
  those 4 will be deleted." Surprise is the expensive thing, not the deletion.
- **No idioms, metaphors or figurative language.** Nothing is "on track",
  nothing "burns" a month, there is no "runway".
- **Name the real stake, plainly and without drama.** "Earning this much can
  stop your monthly payments." Softening it is not kindness.
- **Round down, always.** Ten and a half hours of room reports as ten. Wrong
  downward costs a few hours of pay; wrong upward costs a debt to Social
  Security.
- **Answer in hours where you can.** Dollars are the unit the rule is written
  in; hours are the unit the decision is made in.
- **The number people have is net.** Ask for what reached the bank and
  convert, out loud — see `PayAmount.tsx`.

Repeating phrases are functions, not strings: `roomLine`, `overLine`,
`roomToTargetLine`, `trialMonthsLine`, `periodLabel`. "$162 left" was printed
by six files and four of them never said what it was left of.

## 1.5 If it needs explaining, it is designed wrong

*"A long explanation is a symptom of bad design."* Prefer teaching by
interaction — typing miles and watching the deduction appear beats a paragraph
about the mileage rule. A help paragraph is the last resort, not the first.

## 1.6 The device is part of the brand

Old Android WebViews. Not preferences, and a polish pass must not introduce
them: no `color-mix()`, no `backdrop-filter`, no web fonts, no blurred
shadows. Prefer flat fills, hard edges, precomputed values.

---

# PART 2 · LOCAL

What a layout owns. **Military on meaning, free on voice** — the labels are
the same set everywhere, and how they read is the layout's to choose.

## 2.1 Tone variants

Three voices, in `src/domain/copy.ts`. Each is a *complete* `Vocabulary`, not
a patch, so a tone cannot silently fall through to another one.

| Tone | Reads like | Layouts |
|---|---|---|
| **plain** | Full sentences, second person, warm. | classic, v2, responsive, horizon |
| **compact** | The shortest *complete* label. Dense monospace columns. | ledger, payguard, workrecord, calc20 |
| **spoken** | Questions, one idea a line, fewest words of any. | pocket, plan |

One example carried across all three, so the boundary is visible:

| Key | plain | compact | spoken |
|---|---|---|---|
| `net` | Money that reached your bank | Reached your bank | Into your bank |
| `paidToYouAsk` | How much did they pay you? | Paid to you | How much did they pay you? |
| `hoursWorked` | Hours you worked | Hours worked | How many hours did you work? |

## 2.2 The line a tone may not cross

A tone may change **register, length, person and punctuation**. It may never
change **the fact, the subject or the number**.

- ✅ "Reached your bank" is "Money that reached your bank", shorter.
- ✅ "How many hours did you work?" is "Hours you worked", asked.
- ❌ "Pay" is not a shorter "Pay before taxes" — it is a missing answer to
  *which number*.
- ❌ "Gross" is not a denser "Pay before taxes" — it is on the NEVER list.

**Shortening may drop words the surrounding row already supplies. It may never
drop the word that carries the meaning.** A column under a job's name need not
repeat "you"; a column of miles must still say *for work*, because personal
miles are not deductible and a reader who types all of them claims a deduction
they are not owed.

## 2.3 The per-layout override

`OVERRIDES` in `copy.ts`: one layout, one word, where its tone is not quite
right for it. Typed as a partial of the master key set, so a layout can only
restate a word that already exists.

Kept deliberately thin. **An entry here is a claim that this one layout needs
a word the others in its voice do not — and most of the time that claim is
false and the tone was the thing that wanted changing.** There are two entries
today.

## 2.4 What a layout owns beyond words

- Its own visual system (`plan` is 16-bit and gilt; `ledger` is monospace
  columns) — argued, not decorative, and not to be "modernised".
- Which surfaces it draws, and in what order.
- Its sub-theme palette.

## 2.5 What a layout never owns

- The meaning of any word in the master vocabulary.
- Any figure or rule — those live in `src/domain/`, shared by all ten layouts.
- Whether both limits are named. One at a time, everywhere.
- Whether an abbreviation is acceptable "in this context". It is not.

---

# 3 · Adding to this system

1. **A new concept** → add a key to `Vocabulary`. The compiler then makes
   every tone answer it. That is the point.
2. **A new phrase that repeats** → a function in `copy.ts`, not a string at
   the call site.
3. **A banned word** → an entry in `NEVER` with the reason, then fix the call
   sites.
4. **A new layout** → give it a tone in `LAYOUT_TONE`. Reach for `OVERRIDES`
   only after the tone has been tried and found wrong.
5. **A change to any of it** → this file and the code in the same pass. If
   they disagree, one is wrong.
