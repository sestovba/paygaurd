# PayGuard

> ## ▶ COLD START — three files, in this order
>
> | | | |
> |---|---|---|
> | 1 | [`docs/THE-THREAD.md`](docs/THE-THREAD.md) | **The train of thought.** What we currently believe and what changed our mind. Read this first — it is the file that stops a session re-deriving conclusions already reached. |
> | 2 | [`review/REVIEW-NOTES.md`](review/REVIEW-NOTES.md) | **The brief and the queue.** First ~50 lines only. |
> | 3 | this file | **The rules.** Read the section you are about to work in. |
>
> [`docs/HANDOFF-2026-09-03.md`](docs/HANDOFF-2026-09-03.md) is the most recent
> session baton — read it only if you are continuing that specific work.
> Finished handoffs live in [`docs/archive/`](docs/archive/README.md).

> ## ▶ About `review/REVIEW-NOTES.md`
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
- **A finished note leaves the queue.** A note that asks for a change and has
  an answer on it is closed and moves to the History section, whoever typed
  the status. Only one with *no* answer at all reads back as `sent`.

  Closing used to also require the reply to spell a filename. Measured
  against the real file that rule held **144 of 193** finished notes open
  forever — 142 of them had a genuine answer ("Removed the Avg Active Month
  tile") that simply did not contain a path. It was scoring prose, not
  completeness, and it is gone. Do not reintroduce it.

- **The two queues are separate.** "Owed to Claude" is what *the reviewer*
  raised. Notes Claude wrote for itself go under "Claude's own backlog" —
  they were half the file, and mixing them made the reviewer's list twice as
  long as their actual queue. Closing one of Claude's own notes is Claude's
  job; the reviewer never has to reply to anything.

- **Disagreeing reopens it.** Speaking after an answer, or pressing Reopen,
  makes a settled note owed again — `reopenedAt` outranks the reply that
  closed it. "You say it's done, I say it's not" is one press and needs no
  words.

- **`npm run review`** regenerates `REVIEW-NOTES.md` from the JSON without
  the dev server, using the app's own generator. `npm run review:check`
  reports the counts and exits non-zero if the report is stale. Use it after
  answering notes by hand — that is exactly when the server is stopped and
  the report would otherwise go out of date.

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
- **Anything with no element to point at** — a rule, a whole layout, the
  product: press `C` with nothing selected. The composer opens with a **scope
  row** — *This · Layout · Everywhere* — and files the note against a heading
  that already exists in the markdown, so "default should be rest of the year
  on all layouts" lands on `CLAUDE.md › Who this is for` rather than on
  whichever card the cursor was over. Scope is what the note is *about*; the
  layout it was written in is kept separately, as where it was *seen*.
- **Back end, domain or build**, where even that is wrong: the note still gets
  written by hand the way this section describes — `id`, `reason`, and
  `anchor.source` naming the file. A comment with no anchor is worth more than
  no comment.

Work in flight is written down the same way as work finished. "Halfway
through X, next step is Y" in a note beats a perfect summary in a message
that the next model will never see.

## What the product is

**A job-search calculator that later becomes a record keeper.** In that order.
It was built the other way round and that is the largest open correction in
the project — see `task-simulator-is-the-product`.

The owner's own route in: he got SSDI, heard about the rules, asked an AI
what they meant, and then realised **his job search criteria depended on the
answer** — what hourly rate, how many hours, what schedule to even apply for.
It is always a part-time job. He did not have the variables.

So there are two phases and one question between them:

| | Phase 1 · **Deciding** | Phase 2 · **Recording** |
|---|---|---|
| When | Before the job exists | Once you are working |
| Asks | What should I apply for? | Am I about to go over? |
| Gives | Hours a week, an hourly rate, a schedule | A verdict per month |

The hinge, asked once, right after onboarding — never buried in Settings:

> **Are you employed, or actively looking for work?**  · I'm working · I'm looking

**The simulator is the front door, not a tool in a drawer.** Today it is
`SafeWorkSimulator`, reachable through Settings or the status page, and that
is backwards.

Two rules for anything built on this:

- **It runs both ways.** Somebody looking for work has no hourly rate yet —
  they have a body that can manage a certain number of hours. `rate → hours`
  is what `capacity.ts` already does; `hours → rate` ("I can manage 10 hours,
  what can I be paid?") is the same equation solved for the other unknown,
  and it is the actual job-search criterion.
- **Every hours figure is derived, never printed as a rule.** "You can work
  about 10 hours a week" is `SAFE_MONTHLY ÷ 4.33 ÷ your rate`. It is 10 at
  $21.50 an hour, 15 at $15, and 6 at $35. Hard-coding it hands a low-paid
  worker a wrong answer in the direction that costs them money.

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
  shared `MonthGrid`) show **the rest of the year** — this month and the ones
  after it. One row in a layout drawn around twelve reads as a page that
  failed to load, not as a deliberately quiet screen. It used to default to
  the months *behind* you, on the grounds that those are the ones with data
  in them; that is true and beside the point, because nothing behind you can
  be acted on. The screen is a plan, not a record. Those layouts each carry a `MonthScopePicker`
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

### The device is the floor, not the ceiling

Old Android WebViews: cheap handsets, 1–2GB of RAM, un-updated engines,
metered data. That is real and it does not change. What changed is how the
constraint is written down.

**It used to read as a ban** — no `color-mix()`, no `backdrop-filter`, no web
fonts, no blurred shadows. Measured against the source, that rule was already
dead: **144 uses of `color-mix()` across all eight stylesheets** and **89
`backdrop-filter`s**, including in `plan` and `pocket`, the two layouts the
rule named as its own reference. A prohibition that every file violates is not
protecting anyone; it is just wrong in the file.

It was also three different problems wearing one rule, and only the first has
a free answer:

| Question | Answer | Applies to |
|---|---|---|
| **Can the engine do it?** | CSS answers itself. Ship the precomputed value, then override inside `@supports`. Old engine gets the flat fill, current one gets the better version, nothing is sniffed. | `color-mix()`, and any new property |
| **Will it cost frames?** | A budget, not a capability. `@supports` will happily enable something that then runs badly, so this stays a judgement call per surface. | `backdrop-filter`, blurred shadows |
| **Will it cost data?** | Neither of the above. `font-display: swap` behind a real fallback stack degrades on its own, and `navigator.connection.saveData` / `effectiveType` can decline the download outright. | web fonts |

So the rule is now:

- **The flat version is the floor and it is not optional.** Every surface must
  be complete and readable with no `@supports` block ever matching. Build that
  first; it is what most of this audience sees.
- **The better version is free and goes in an `@supports` block.** Withholding
  it costs the reader on a current phone — who is most of them — and buys the
  reader on an old one nothing.
- **Frames and bytes are still budgets.** Support is not permission. A blur
  that a WebView understands and renders at 20fps is still wrong.

`payguard.css:1598` already does this, correctly, and nothing said so:

```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  /* the solid fallback */
}
```

**Prefer flat fills, hard edges and precomputed values as the baseline.** That
part never changed — it is what the floor is made of.

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

There are **nine** layouts in `src/components/`, and they are not nine drafts
of one app competing to win. **Eight of them are how features get discovered.**
Each was built to find out what a screen could be, and each found something the
others did not — pocket found that the fastest way to log pay is to draw almost
nothing, calc20 found the smoothest interaction in the product, ledger found
that tabs make entry pleasant. That is the point of having eight.

**`beautiful` is the ninth and it is a different kind of thing: the first one
written from a spec rather than discovered.** It is what the other eight were
for. Read it as the output of the process below, not as a competitor in it —
and when it is wrong, the fix is the spec, not another layout.

So the instruction is not "converge on the best one". It is: **know what each
one is good at, because the next thing gets built out of those parts.**

Shared editors (`MonthSheet`, `StreamSheet`, `SettingsPanel`, `Sheet`) reach
most layouts at once, so a change there is worth more than a change in one
screen. All four are on the shared control layer, and so is `beautiful`;
the eight older shells are not yet — see `task-migrate-remaining-controls`.

### Each layout documents itself

Every layout folder carries a `README.md` written from the audit of
2026-09-03: what it is, the owner's verdict in his own words, which of the
eight primary features it has and which it is missing, its score, its size,
and the rules specific to it.

```bash
npm run layouts          # the whole matrix, scored
npm run layouts -- plan pocket   # just those two, and what differs
```

**That README is also the registry.** The layout switcher and the review
console build their lists from these files at compile time — the folder is
the id, the `# Title` is the label, the bold lead sentence is the
description, and one comment line says where it sits:

```
<!-- registry: order="3" group="The least on screen" -->
```

So adding a layout is adding its folder and its README. There is no central
list to keep in step, which is exactly how the console's copy came to be
missing four of the layouts — Plan among them — with nothing about reading
either file to say so. `vite.layouts-plugin.ts` is the whole mechanism.

**Do not copy those numbers into a document.** They were hand-written into
this file once and had already drifted by two layouts within a session — the
script re-derives them from the source every run, which is the only way a
table like this stays true. The per-layout READMEs carry a snapshot for
context; the command is the authority.

Roughly, as of 2026-09-03: `overview` leads on breadth (8/8 primaries),
`horizon` on leanness (~140 points per 1k lines), and `calc20` costs about
2.5× more per point than anything else.

**Importance is a different axis from the score, and it is the one that
decides things.** The matrix measures breadth; the owner's account of what each
layout is *for* supersedes it — a layout can come last on points and be the
heart of the product, which is exactly what `pocket` is.

| Layout | Irreplaceably good at | Mobile | Desktop |
|---|---|---|---|
| `pocket` | Logging pay — "nothing is easier" | **built for it** | — |
| `plan` | Deciding in hours; trial months as permission | **built for it** | — |
| `ledger` | Entry through tabs, and the vibe | workable | **shines** |
| `calc20` | The smoothest front end in the product | **built for it** | **holds up** |
| `overview` | Completeness — every primary | workable | **side-by-side is superb** |
| `workrecord` | Density on a phone | **pretty good** | **does not hold** |
| `payguard` | Desktop editing; the editor workrecord borrows | **afterthought** | **built for it** |
| `horizon` | The forward view — reads, does not let you act | workable | workable |

**The split is a viewport split, not a quality split.** Only `calc20` is named
as working on both, which is why "most impressive and smooth" and "brittle and
hard to maintain" are both true of it: its value is interaction quality, which
is portable, and its cost is architecture, which is not. Take the feel, leave
the shim.

`pocket` and `plan` are one family and are meant to cross-pollinate — build
them as one phone experience rather than two.

Read the score as breadth, not fitness — `pocket` is last because it is
deliberately subtractive, and that is the whole point of it. The columns that
carry a decision are **primaries** (what is missing) and **per 1k** (what it
costs to keep).

Three findings the table makes hard to argue with:

- **The feature the product now leads with barely exists.** "Answer in hours"
  is in 2 of 8 layouts. The two-way version — *"I can manage 10 hours, what
  can I be paid?"* — is in none.
- **The two layouts best at data entry cannot do the arithmetic.** `ledger`
  and `payguard` have no mileage deduction and no net → before-tax
  conversion, so a delivery driver typing into the fastest surfaces in the
  product sees the wrong number counted against their limit.
- **`calc20` costs 2.5× more per point than the next worst** and is the only
  layout carrying its own `UiState` shim.

### Crossbreeding, not transforming

The next layout is **built new, from a spec we control, out of parts chosen
from the eight**. It is not any existing layout refactored into a better one.

That distinction decides how work gets planned, so it is worth being exact
about why. Transforming a layout means inheriting its architecture along with
its good idea — calc20's interaction quality is worth having and its `UiState`
shim is not, and a refactor takes both. Building fresh from a spec means the
good idea arrives without the thing it was wrapped in.

**Two directions, and they are different jobs:**

| | | |
|---|---|---|
| **Crossbreed** | forward, into a new layout | Pick the traits we want — the interaction from one, the restraint of another, the entry model of a third — and write a spec that names them. Nothing is inherited by accident. |
| **Cross-pollinate** | sideways, between the eight | A trait that turns out to be right belongs in its cousins too. This is the existing rule — *a comment is a direction, not a local edit* — under its proper name. |

Both are traits **and functionality**: an interaction pattern crossbreeds
exactly like a feature does, and the interaction is usually the part worth
more.

**Get it right the first time — refactors are the expensive way to be
correct.** This is the argument for the spec, not a platitude about care. The
eight layouts already paid the discovery cost; what they bought is the ability
to write down, in advance, exactly what the ninth does and how it behaves. A
decision made in a spec costs a sentence. The same decision made after the
code exists costs the code, everything built on it, and the session that finds
out. `calc20` is the standing proof: nothing is wrong with what it does, and
it is still the layout nobody wants to touch.

So the order is **spec, then build** — and the spec is cheap because the
research is already done and sitting in eight folders.

**`npm run layouts` is the trait table.** It derives the matrix from the
source, so "what does pocket have that plan doesn't" is a command, not an
audit:

```bash
npm run layouts -- plan pocket
```

#### Lean code is a trait too

Good layouts need good engineering — a layout that costs 11,000 lines cannot
be maintained, cherry-picked from cleanly, or read by the next model. The
**per 1k lines** column is the leanness score and it is a goal, not a
curiosity:

- `horizon` gets **140.8** points per 1,000 lines. `calc20` gets **7.7**.
- Both are worth learning from, and only one is worth copying wholesale.
- **The budget works.** `beautiful` was budgeted at 1,150 lines before one was
  written and came in at 1,077, for 82.4 per 1k — second in the product. Budget
  first; it is the only part of this that has been tested.
- A trait that only works because of 4,000 lines of scaffolding did not
  actually work. Take the idea, write it lean, prove it stays lean.

When crossbreeding, budget the lines before writing them. If a chosen trait
cannot be rebuilt inside a sane budget, that is a finding about the trait.

#### When two layouts really are one

`overview/` was three layouts — classic, v2 and responsive — and it was never
three. Every surface they drew was used by those three and by nothing else;
what differed was the chrome and where a detail opens. That is
`UiState.overviewShell` (`scroll` / `pages` / `workspace`) picking one of
three files in `overview/`, with `detail.tsx` rendering the six detail views
all of them share.

**The test is the component matrix, not the look.** If two layouts draw the
same surfaces and differ only in chrome, they are one layout with an option.
If they draw different surfaces, they are two layouts however similar they
feel — and by that test the remaining eight are eight:

| | |
|---|---|
| `plan` · `pocket` · `horizon` | Same job — one phone screen answering "what can I do this month". Share **no** content components: each reimplemented the answer in its own markup and its own stylesheet. |
| `ledger` · `payguard` | Parallel implementations of income entry, with their own `*Analysis` and `*JobEditor`. `workrecord` already renders inside `.pg-payguard` and shares its editor. |
| `calc20` | Unique. |

Read that table as **parents available for breeding**, not as a merge backlog.
Nothing on it should be consolidated to save space; the duplication is what
made the comparison possible.

`calc20/` keeps its own `UiState` shim in `calc20/state.tsx`. A new shared
preference must be added in four places there or it silently never arrives —
one of the reasons its idea gets copied and its code does not.

## One base, and every theme's override layer

**A theme is an override. Nothing in this app authors a base from scratch.**
Two token files hold every decision, a third draws the controls out of them,
and everything below that may map and override but may not choose:

| File | Owns | Checked by |
|---|---|---|
| `styles/palette.css` | every colour — 39 choices × 6 variants | `theme:check` |
| `styles/metrics.css` | every size, space and shape — a universal scale, plus 14 per-theme shape choices | `theme:check` |
| `styles/controls.css` | the shared Button, IconButton, Field, ButtonRow. Not one literal value | `debt` |
| `components/ui/` | the React side of the same controls | `debt` |

**Spinning off a theme is two blocks.** Copy `paper`'s block in each token
file, change what you mean, run `npm run theme:check` — it names anything you
missed. Colour needs a light and a dark form; shape needs neither, because
shape does not follow ink. Then add the id to `UiState.palette`. That is all
of it: switching `data-palette` re-shapes every control in the app, verified
across all five on 2026-09-04 (`ledger` comes out at 44px and 8px where
`paper` is 48px and 12px, with no component and no layout CSS touched).

The two files split their completeness rule differently, on purpose. A colour
variant answers **all 39** every time, because a variant silently wearing
another's warn amber is invisible-wrong. A theme answers **all 14 shape
choices or none**, because one that wants paper's 4dp grid should say nothing
and get it — restating every value would bury the one line that differs.

### Why not MUI

"Material Design as the base" is right and MUI is the wrong way to get it.
Emotion injects CSS at render, which is the worst profile for the 1–2GB
Android WebView this app treats as the floor; theming it moves the source of
truth into a JS object, which inverts the override rule and orphans
`theme:check`; and MUI's own team is migrating toward headless + zero-runtime,
which is the architecture already here. Material 3 ships as **tokens** now,
not a CSS framework, so `metrics.css` takes M3's scales directly. Two
departures from M3 are documented in that file — the 48px control height and
the 14px type floor — and both are about this audience.

## The palette itself

**`src/styles/palette.css` is the only file that chooses a colour.** 39
choices, six variants, two axes:

- **variant** — `paper` · `slate` · `ledger` · `carbon` · `calc20` · `calm`. The hue
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
npm run dev:lan       # the same, on the LAN — open it on the phone itself
npm run typecheck     # tsc --noEmit
npm run build         # typecheck + vite build
npm run build:calc20  # Calc20 alone, as one file: dist-calc20/calc20.html
```

Four reports, all answering a question that otherwise costs a fresh audit
every session. Three read the tree and write nothing; `review` regenerates
`REVIEW-NOTES.md` from the JSON, which is the one file it is allowed to
rewrite:

```bash
npm run state     # branch, uncommitted work by area, open queue count
npm run layouts   # the trait matrix — add two names to compare just those
npm run words     # banned vocabulary still in a user-visible string
npm run debt      # hand-rolled controls and off-token sizes, per file
npm run review    # regenerate REVIEW-NOTES.md from the JSON
```

**`npm run debt` is a ratchet, not a report.** It fails the build when a
file's count of hand-rolled buttons or off-token sizes goes **up**, and when a
file with no baseline has any at all — so a new layout cannot start by
inventing a 49th button class. Paying debt down is the point:
`npm run debt:update` banks the progress so it cannot come back. A flat ban
was considered and rejected; it would have failed on 334 existing buttons and
been switched off within a day.

`npm run layouts -- plan pocket` prints only what differs between two, plus
their leanness. `npm run words -- --check` and `npm run review:check` exit
non-zero, so either can gate a build.

The last one is a handover format, not a second deploy: one self-contained
HTML page carrying the Calc20 layout on the same `pg-data-v1` record, with no
sign-in, no Firebase, no other layouts and no review console. It opens by
double-click. `vite.calc20.config.ts` is the whole of it, and its header says
what is left out and why.

The review console is dev/localhost only and is never in a published build.
Open it with ⌥R or the button bottom-right. `D` selects, `C` comments — and
`C` never refuses: with nothing selected it opens against the layout.

**Reviewing at a phone width.** The console's device control renders the app
in a frame of a real device size, so its own media queries resolve against a
real viewport. Narrowing the rail does not do that — a media query asks the
viewport how wide it is, and a page squeezed into a narrow column inside a
wide window still answers "wide", drawing a desktop layout in a phone-shaped
hole. Pointing works inside the frame, and every note records the width it
was written at.

What the frame is not, and cannot be made into, is Safari on a phone: same
engine as the window, so font rasterisation, `env(safe-area-inset-*)`,
rubber-band scrolling, the shrinking URL bar and iOS text inflation are all
absent. For those, `npm run dev:lan` and open the printed address on the
phone — the console runs there too.
