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

# 0.5 · Who reviews every change

**Every decision in this file gets looked at by a full senior team, not by one
opinion.** Nobody here is junior, nobody defers, and a change that only
satisfies one of them is not finished.

Each seat is a *question*, not a job title — a seat with no question attached
is decoration. Run the list before calling anything done:

| Seat | The question it asks |
|---|---|
| **Content strategist** | Which number, which period, of what, so what? Would a reader wonder what this means? |
| **Product owner** (Sergey) | Is this the product we agreed on, or did it drift while nobody was looking? His words overrule the labels, and this file, and me. |
| **The user** — on SSDI, tired, worried about money, on a cheap Android | Can I answer my actual question — *can I take this shift* — without learning anything first? |
| **UI/UX architect** | Is the hierarchy right? Is the most consequential state the loudest thing on screen? |
| **Program manager** | What did this break elsewhere? Which cousin layouts now disagree? Is it actually finished — code, typecheck, running app, note written? |
| **AI reasoning** (me) | What does the code actually do, as opposed to what the comment claims? What have I asserted without checking? |
| **Benefits counselor** | Is the rule right? Name the limit that applies and never the other one. Being wrong here is a debt a real person repays. |
| **Accessibility specialist** | Does this survive an old WebView, a screen reader, low vision, and a reader who cannot hold two ideas at once? |
| **QA** | Did anyone *open the app*, or does this rest on a passing typecheck? Rendered text, not source greps. |

Three of those seats exist because this project has been burned by their
absence, and they are the ones to be slow in:

- **QA.** Twice in the content audit a surface was declared clean from a
  source scan and the browser then found more — a `W2` with no hyphen, a
  `260mi` built from a suffix. A grep finds the strings you wrote; only the
  running app shows the strings it renders.
- **Program manager.** The one-limit rule was fixed on the ledger's chart and
  not on payguard's, so for months the two layouts contradicted each other in
  front of the same reader.
- **Benefits counselor.** Round down, always. Wrong downward costs a few hours
  of pay; wrong upward costs a debt to Social Security.

When two seats disagree, the product owner decides. When the disagreement is
about a *fact* — a threshold, a rule, a rounding direction — nobody decides;
we go and check.

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
| The panel that turns a limit into hours | **Recommended hours** | Safe work simulator, work pay simulator, safe hours |
| The control that opens it | **How many hours can I work?** | Plan my hours, open simulator |

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

  **One argued exception, 2026-09-04.** On a strip of month cards where the
  month name is a *label on a card*, not a word in a sentence, the owner asked
  for `Sep · Oct · Nov · Dec` and a bare `left`: *"I like Sep, OCT, and a
  simple left"*. That stands, and it is bounded by two things. The card must
  carry the full month name for a screen reader — `beautiful` does this with a
  `.bb-sr` span — so the shortening costs the eye nothing and the ear nothing.
  And it applies to **names**, never to units: `hrs` and `mi` remain banned,
  because a shortened unit is a shortened *meaning* while a shortened month is
  still that month.
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

## 1.5 Every quantity is what is left

**The glass is half empty, and on this screen that is the honest half.**

A number in this app is a remainder, never an accumulation. "46 hours left",
not "you can work 46 more hours". "$993 left before the $1,000 we aim for",
not "$7 of $1,210 earned". The arithmetic is identical and the instruction is
opposite.

This is not pessimism, it is the direction the reader is actually travelling.
Everything this app measures is being **used up** — the room in a month, the
hours in a rate, the nine trial months in a rolling sixty. A figure that
counts *up* toward a limit is describing progress toward the one outcome the
reader is afraid of, and it invites them to close the gap.

The failure is easy to miss because the counting-up version reads as
encouraging:

| Written as filling | Written as what is left |
|---|---|
| You can work about 46 more hours this month | **46 hours left this month** |
| $7 of $1,210 earned · 1% | **$993 left before the $1,000 we aim for** |
| 1 of your 9 trial work months used | **8 of your 9 trial work months left** |
| 4 months completed | **the months still ahead of you** |

Two rules follow, and the second is the one that gets forgotten:

- **State the remainder, not the total consumed.** If both are worth showing,
  the remainder is the headline and the total goes underneath — which is also
  why a month row leads with "$993 left" and not with what has been logged.
- **Never draw a quantity filling toward a limit.** A progress bar or ring
  that fills as earnings rise is a completion metaphor — people have been
  taught by their watches to *close* a ring — pointed at the number they must
  not reach. It looks most rewarding at the moment it should look most
  careful. Anything of this shape must **deplete**: start full, empty as it is
  spent, so the instinct to keep it full agrees with the goal.

**The exception is permission.** Trial work months are a protection the rule
grants, not a resource the reader is burning, so they are said as what is
still available — "you have 8 of your 9 left, in one of those you can earn any
amount and keep your payments". That is still the remainder; it is simply a
remainder of something good. The test is not optimism or pessimism, it is
whether the reader is being told **what they still have** or **how close they
are to the edge**.

## 1.5.5 A button label starts with a verb

**Sergey: "Button labels should suggest an action. Start with an action."**

A control's label is a promise about what pressing it does, so it opens with
the doing word. The failure is not vagueness — it is labels written from the
reader's side as *statements about themselves*, which describe a situation and
leave the button's behaviour to be inferred.

Pocket had four, and three of them began with "I":

| Was | Is | Why |
|---|---|---|
| I got paid | **Log Pay** | A statement of fact. The button does not get paid; it opens the log. |
| I know my paystub pay amount | **Enter my paystub amount instead** | Describes what the reader knows, not what the tap does. |
| I only know what reached my bank | **Enter what reached my bank instead** | Same. |
| None of these — add a job | **Add a job** | Opens on a negation; the verb was buried past a dash. |

Two rules:

- **Open with the verb, and let it be the verb that actually runs.** "Log Pay"
  opens the log; "Add pay" commits it. Two verbs because they are two
  different acts, and a reader who presses the first and sees the second knows
  exactly where they are.
- **A confirmation echoes the verb.** Press *Add pay*, and what comes back
  says "added", not "saved" or "recorded".

**The exception is an answer, not an action.** A control that answers a
question the screen has just asked is labelled as the answer, because forcing
a verb into it breaks the sentence the reader is already in the middle of:

> Do you want to enter paystubs from now on?  · **Yes, from now on** · **Just this time**

The test is whether the label completes a question above it. If it does, it is
an answer. If the reader has to work out what the button does, it is a
mislabelled action.

## 1.6 Graphics must be readable without being learned

**The three layouts rated highest by the owner — `plan`, `pocket` and
`horizon` — all refuse the chart.** That is not a coincidence and it is the
strongest evidence in the project about what works for this reader.

- `pocket` draws **nothing**. A number as the headline, the consequence on its
  own line. It is the fastest screen in the product to read.
- `plan` draws **twelve countable chunks** in three *patterns*, with the
  safety line and the limit labelled where they sit.
- `horizon` draws a row of **month stops**, each with its own state.

None of them draws a continuous proportional graphic — a ring, an arc, a
percentage dial — because those ask the reader to **estimate a proportion**,
and estimating is the one thing this reader should never have to do. A ring is
a dashboard convention: it assumes the reader has seen dashboards.

Four tests before any graphic goes on a screen:

1. **Can it be labelled in three words?** If not, it is an ornament that asks
   the reader a question, and they have enough questions. *"I see a ring —
   what's this?"*
2. **Does it mean anything while empty?** `plan`'s gauge colours by *where a
   chunk sits*, so a new user with no data already sees where safe ends. A
   ring with nothing in it is a blank circle.
3. **Does it survive losing colour?** Encode state in pattern, shape or
   position first; colour only ever repeats what is already there.
4. **Does it state its value in words too?** The graphic is decoration over a
   fact that is already written, and it is `aria-hidden` when it is.

If a graphic passes all four it is earning its place. If it fails one, the
sentence it was replacing was better.

## 1.7 If it needs explaining, it is designed wrong

*"A long explanation is a symptom of bad design."* Prefer teaching by
interaction — typing miles and watching the deduction appear beats a paragraph
about the mileage rule. A help paragraph is the last resort, not the first.

## 1.8 The device is part of the brand

Old Android WebViews: cheap handsets, un-updated engines, metered data. Flat
fills, hard edges and precomputed values are the **baseline** — the version
every reader gets.

This used to read as a flat ban on `color-mix()`, `backdrop-filter`, web fonts
and blurred shadows. It is a floor, not a ceiling, and it is three questions
rather than one:

| Question | Answer |
|---|---|
| Can the engine do it? | Ship the precomputed value; override in `@supports`. Free. |
| Will it cost frames? | A budget, not a capability. Judgement, per surface. |
| Will it cost data? | `font-display: swap` plus a real fallback stack, and `navigator.connection.saveData` to decline the download. |

**The flat version must be complete on its own** — every surface readable with
no `@supports` block ever matching. Past that floor, a better rendering for a
current phone is free and withholding it helps nobody. See
`CLAUDE.md § The device is the floor, not the ceiling`.

---

# PART 2 · LOCAL

What a layout owns. **Military on meaning, free on voice** — the labels are
the same set everywhere, and how they read is the layout's to choose.

## 2.1 Tone variants

Three voices, in `src/domain/copy.ts`. Each is a *complete* `Vocabulary`, not
a patch, so a tone cannot silently fall through to another one.

| Tone | Reads like | Layouts |
|---|---|---|
| **plain** | Full sentences, second person, warm. | classic, v2, responsive, horizon, beautiful |
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
- Its **shape** and its **density** — radii, spacing, type, how much fits on
  a screen. This is where a layout's identity actually lives.

## 2.5 What a layout never owns

- The meaning of any word in the master vocabulary.
- Any figure or rule — those live in `src/domain/`, shared by all eight layouts.
- Whether both limits are named. One at a time, everywhere.
- Whether an abbreviation is acceptable "in this context". It is not.
- **Its palette.** A layout used to own this, and five of them declared
  their own values. There is one palette now — `src/styles/palette.css` —
  with the variants as options on it. A layout **bridges** it onto whatever
  token names its call sites already use, and may keep an **override layer**
  for what is genuinely its own, marked `@override <layout> — <why>`.

  The line between the two is the useful part. Plan's paper, ink and status
  colours bridge; its sprite outline, 1999 bevels and gilt band override,
  because those are the parts of a drawn object and no palette has an opinion
  about them. If you cannot write the sentence after the em-dash, it is not
  an override — it is a colour you forgot to map.

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
