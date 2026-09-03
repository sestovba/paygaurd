# PayGuard

> ## ▶ START HERE: `review/REVIEW-NOTES.md`
>
> **That file is the brief.** It is the product owner talking about this app,
> screen by screen, in their own words. Most of what looks like a free choice
> in this codebase has already been decided there, and the reasoning is in the
> note.
>
> **Read the first ~50 lines, not the file.** It is ~1,900 lines and the body
> is mostly closed items. Everything you need on a cold start is in three
> generated sections at the top:
>
> | Section | Is |
> |---|---|
> | **Owed to Claude** | the work queue. If it says *nothing is waiting*, there is none. |
> | **Claims that do not match the code** | notes filed as done whose element is still in the source. One of the two is lying — check before trusting either. |
> | **Not anchored to anything** | comments with no element. Not actionable until they point at something. |
>
> Read a layout's own section in the body only when you are about to work on
> that layout. To search the whole set, query `review/review-notes.json`
> (~180 notes, 266KB) rather than reading the Markdown.

## Where things stand right now

`npm run state` regenerates [`docs/STATE.md`](docs/STATE.md) — branch,
uncommitted work grouped by area, recent commits, and the open queue count.
**Run it at the start of a session.** It reports facts; the *why* behind
anything in flight lives in the review notes, per the notepad rule below.

## ▶ Also read: `docs/WORKING-WITH-SERGEY.md`

How to read a request and answer it, what is locked, and where being wrong is
expensive. It is clustered by impact — the first section applies to every
message. Four things from it before you touch anything:

- **Never start what you cannot finish.** Finished = code changed + typecheck
  passes + verified in the running app + review note replied. If all four do
  not fit in the budget left, split it or write it down and ask.
- **"Why is …" is a change request, not a question.** Answering with the
  reason and stopping is a non-answer.
- **A comment is a direction, not a local edit.** Fix the rule, then carry it
  to the cousin layouts.
- **Never call visual work done from a passing typecheck.** Open the app.

If the code and that file disagree, one is wrong. Fix it — never leave a
contradictory rule standing.

## Answering a review note

Notes live in `review/review-notes.json`. `review/REVIEW-NOTES.md` is the
human-readable report generated from it — read the Markdown, write the JSON.

To answer one: append to its `thread` array with
`{"from":"claude","text":"…","at":"<ISO>"}`, set its `"status"`, and bump
`updatedAt`. The app merges it in and shows your reply beside the comment.

`REVIEW-NOTES.md` documents the status vocabulary in full. Two rules that
catch people out:

- **Do not hand-edit either file while the dev server is running.** The app
  owns them and will overwrite you. Stop the server first.
- **Stopping it is not enough — the browser holds a copy.** The page loaded
  the notes once and pushes its whole in-memory set back on the next run, so
  notes you added while the server was down are wiped the moment you start it
  again, not just while it is up. Write notes **last**, after the final
  verification pass, and do not start the server again afterwards. If you must
  (re-verify, another round of feedback), expect to re-add them and check with
  `git diff review/review-notes.json` before committing.
- **`done` is never asserted, only earned — but the earning closes it.** It
  is a claim about the code, so a note that still owes a change and has no
  reply naming the file it changed reads back as `sent`, whatever the word
  says. A reply that *does* name a file closes the note itself and marks it
  "by Claude": the reviewer pointed at a thing and said what to do, and work
  they asked for and received is not work left in their queue. Reopen is one
  press away, and the evidence is re-checked on every read.

- **The reviewer's words overrule the labels.** A verdict is a button pressed
  once and a tag is a chip picked off a list; the sentence is what they
  meant. A note whose comment opens with an instruction takes its verb from
  that sentence, above any verdict or tag. Only when it is unambiguous — the
  patterns are anchored to a leading imperative, so "remove the border" is an
  ask and "I would not remove this" is not. Anything unclear falls through to
  the labels rather than being guessed at.

`src/review/VOCABULARY.md` is the console's own dictionary — one word, one
meaning. If you add or rename a label, it goes there first. The *product's*
dictionary is a different file: [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md).

## The review file is also the notepad

`review/review-notes.json` is not only the reviewer's queue — it is where
Claude writes things down too. Work that gets discovered mid-pass and does
not belong in the change being made goes in there as a new note rather than
into a message that scrolls away or a TODO in the code. Give it an `id` that
says what it is (`task-…`, `audit-…`), `"origin": "suggested"`, a `reason`
naming what raised it, and the `anchor.source` file it lives in.

That is what makes the queue survive a session. The same two rules apply:
the dev server owns the file, so stop it before writing, and a task is only
`done` once a reply in its thread says which code changed.

### Always leave the trail there

**Every piece of work gets a note, before or as you do it — not only the
things you discover and set aside.** A session ends whenever it ends, and
the next one may be a different model with none of this conversation. The
notes file is the only thing both of you can read.

- **Front end:** use the console itself. `D` selects, `C` comments, and the
  note it writes carries the element, its DOM path and the source file and
  line off the React fiber — an anchor no one can type by hand as well.
  Comment on the thing you are about to change, then answer your own note
  in its `thread` with what you changed.
- **Back end, domain, build, or anything with no element to point at:** the
  note still gets written, by hand, the way this section describes — `id`,
  `reason`, and `anchor.source` naming the file. A comment with no anchor is
  worth more than no comment.

Work in flight is written down the same way as work finished. "Halfway
through X, next step is Y" in a note beats a perfect summary in a message
that the next model will never see.

## Who this is for

Not a general-purpose finance app. Every user is on SSDI/SSI — disabled, low
income, often on a cheap Android with an old WebView. Many do gig work.
These are constraints, not preferences:

- **This month only.** `UiState.focusMode` (default **on**) takes the
  calendars, the charts and the year totals off every layout. A twelve-cell
  grid is a wall for this reader, and nobody keeps a benefits tracker current
  for a year.
- **How many months is a separate question.** `UiState.monthScope` owns it —
  `month` / `sofar` / `ahead` / `year`, in `domain/months.ts`. Unset means
  "whatever focus mode implies", and that is not the same answer everywhere:
  the layouts built for one month (`plan`, `pocket`) show one, and the ones
  built to hold a year (`ledger`, `payguard`, `workrecord`, `calc20`, and the
  shared `MonthGrid`) start at this month and keep what is behind it. One row
  in a layout drawn around twelve reads as a page that failed to load, not as
  a deliberately quiet screen. Those layouts each carry a `MonthScopePicker`
  so the reader can say; `plan` and `pocket` do not, and `resolveScope`
  ignores the setting for them.
- **The number people have is net.** Gross is what SSA counts and what almost
  nobody can find. Ask for what reached the bank and convert, out loud.
- **Answer in hours where you can.** Dollars are the unit the rule is written
  in; hours are the unit the decision is made in.
- **Aim at $1,000, not the limit.** `SAFE_MONTHLY` in `domain/rules.ts`. An
  extra paycheck month will clear a $200 margin without warning.
- **Miles are the 1099 lever.** $1,000 from a delivery app can be under $300
  countable once mileage comes off, and almost no driver knows it.
- **Say it plainly.** No jargon ("TWP", "1099", "gross"), no idioms, one idea
  per sentence. The words themselves — the master vocabulary, the four
  questions every label has to answer, the banned list, and the per-layout
  tone variants — are [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md), with
  `src/domain/copy.ts` as its executable half.
- **If it needs explaining, it is designed wrong.** Prefer teaching by
  interaction — typing miles and watching the deduction appear beats a
  paragraph about the mileage rule.

### The device is the constraint

Old Android WebViews. These are not preferences and a polish pass must not
introduce them:

- no `color-mix()`
- no `backdrop-filter`
- no web fonts
- no blurred shadows

Prefer flat fills, hard edges and precomputed values. `plan/` and `pocket/`
are built to this and are the reference.

## Where the truth lives

`src/domain/` is the source of truth and is shared by every layout. Fix
things there, not in a layout, and every screen gets it at once.

| File | Owns |
|---|---|
| `rules.ts` | SSA/IRS figures per year, the 80-hour rule, `SAFE_MONTHLY` |
| `earnings.ts` | What counts: gross, mileage, `nearLimit` |
| `trialWork.ts` | The 9 months in a rolling 60, and which limit applies |
| `capacity.ts` | Room in **hours**, the three stages, the estimate band |
| `months.ts` | `scopedMonths()` — the one helper every month list goes through |

There are ten layouts in `src/components/`. `plan/` and `pocket/` are the
reference shape; the older ones are being peeled back toward them. Shared
editors (`MonthSheet`, `StreamSheet`, `SettingsPanel`, `Sheet`) reach most
layouts at once, so a change there is worth more than a change in one screen.

`calc20/` keeps its own `UiState` shim in `calc20/state.tsx`. A new shared
preference must be added in four places there or it silently never arrives.

## One palette, and every theme's override layer

**`src/styles/palette.css` is the only file that chooses a colour.** 39
choices, five variants, two axes:

- **variant** — `paper` · `slate` · `ledger` · `carbon` · `calc20`. The hue
  and the paper. Answers all 39 choices, every time; a variant never inherits
  one. `UiState.palette` picks it, `data-palette` on `<html>` carries it.
- **ink** — light / dark, from `UiState.theme`. Elevation follows ink, not
  variant. A variant with no light form says so with `color-scheme: dark` in
  its own block (`carbon`), and `applyTheme` reads that back off the
  stylesheet and forces `.dark`, so every `.dark`-keyed rule in the app is
  correct for it without naming it.

Every other stylesheet is two things and says which:

| | |
|---|---|
| **bridge** | `--pg-x: var(--t-x)` — maps the palette onto whatever names that file's call sites already spell. No values. |
| **override** | the argued exceptions, each marked `@override <layout> — <why>` in the comment above the block. |

An override needs a sentence, and that sentence is the point: an exception
someone had to justify is an exception someone can find. Plan's sprite ink,
gilt and bevels are overrides; its paper and status colours are not.

`npm run theme:check` (run first by `npm run build`) fails on: a variant
missing a choice or listing one out of order; a `--t-*` set outside
palette.css; a colour *chosen* in an unmarked block; a variant with no dark
form that has not declared itself single-ink; and `index.html`'s `SINGLE_INK`
list drifting from what palette.css says. It also reports, without failing,
the `color-mix()` uses left over and the files not yet migrated.

**Not yet on it:** `calc20.css` (101 colours, its own glass system) and
`pocket.css` (colours hardcoded in rules rather than tokens, so it follows
light/dark but not the variant). Both are listed in `theme:check`'s output
and in the review notes.

## Commands

```bash
npm run dev           # the app, and the review console with it
npm run typecheck     # tsc --noEmit
npm run build         # typecheck + vite build
npm run build:calc20  # Calc20 alone, as one file: dist-calc20/calc20.html
```

The last one is a handover format, not a second deploy: one self-contained
HTML page carrying the Calc20 layout on the same `pg-data-v1` record, with no
sign-in, no Firebase, no other layouts and no review console. It opens by
double-click. `vite.calc20.config.ts` is the whole of it, and its header says
what is left out and why.

The review console is dev/localhost only and is never in a published build.
Open it with ⌘R or the button bottom-right. `D` selects, `C` comments.
