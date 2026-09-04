<!-- Written from the layout audit of 2026-09-03. The feature table is
     generated from the code, not from memory: see task-layout-audit in
     review/review-notes.json for the method and the scoring. -->

<!-- registry: order="3" group="The least on screen" — the heading this layout sits under in the
     layout switcher and the review console. Read by vite.layouts-plugin.ts,
     which builds that list from these files so neither has a copy to keep. -->

# Pocket

**The smallest screen in the product.** Big text, one action, no chart, built
for a cheap Android on slow data.

## What it is for

**Logging pay.** Nothing in the product is easier, and that is its job.

| | |
|---|---|
| **Mobile** | ★ built for it |
| **Desktop** | — not its viewport |

> "the heart of the record logging, nothing is easier"
> — the owner, on importance rather than rank

Cross-pollinates with `plan` — the owner names them as one family.

**Importance is not the score.** The points table below measures *breadth* —
how many features this layout carries. It is useful for spotting gaps and
useless for deciding what matters. A layout can be last on points and be the
heart of the product; `pocket` is exactly that.

## What it contributes to a crossbreed

**The subtraction.**

`pocket` is the proof that the fastest way to log pay is to **draw almost
nothing**. Two lines, one action, no chart, no grid. It is last on points
because it refuses features on purpose, and it is the layout the owner calls
the heart of the product.

| Take | Leave |
|---|---|
| The two-line pattern — the figure, then the one sentence that says what it means. | Nothing much. At 1,053 lines there is little to leave behind. |
| The refusal to visualise. A number a reader can say out loud beats a shape they have to interpret. | |
| Its restraint as a **default**, not a mode: start subtractive, add only what earns its place. | |

> The eight layouts are **feature discovery**, not eight drafts competing. The
> next layout is built new from a spec that names the traits it takes — see
> `CLAUDE.md § Crossbreeding, not transforming`. Run `npm run layouts` for the
> trait matrix, or `npm run layouts -- pocket <other>` to compare two.

## Owner's verdict

> "I think pocket has it right"

## Where it sits

**Phase 2 — recording.** It is the layout for somebody who already has the
job and needs to not go over.

## How it reads at a glance — by refusing to draw anything

**Pocket has no gauge, no chart and no meter, and it is the fastest screen to
read in the product.** That is not an omission to be corrected.

The whole pattern is two lines:

> **"You can earn $211 more this month."**
> "If you earn more than $1,210 this month, it uses 1 of your 9 trial work months."

The file states the rule: *"the number is the headline and the consequence is its
own line underneath."* Two short sentences beat one long one both for
comprehension and for a 320px screen.

Why this wins:

- **Nothing to decode.** No convention to have learned, no proportion to judge.
- **Works read aloud.** A screen reader gets the entire meaning, in order.
- **Works at any size**, in any colour, at any zoom.
- **The consequence is separated from the number**, so the reader gets the fact
  and then what it means to them — rather than one sentence carrying both.

**If a new design is being judged against pocket, the test is: can it be
understood by somebody who has never seen a dashboard?** Pocket can.

## Score

| | |
|---|---|
| Points | 57 / 129 — lowest, **and that is the point** |
| Primary features | 5 / 8 |
| Size | 625 lines TSX + 428 lines CSS |
| Value per 1k lines | 54.1 |

A low score here is not a criticism. Pocket is the only layout that is
deliberately subtractive, and the score measures breadth, not fitness.

## What it has that others do not

- **The tone the whole product is measured against.** It asks questions
  instead of naming fields: *"How much did you get paid from Cafe shift?"* not
  "Gross earnings". The rules that used to be written at the foot of
  `TrackerPocket.tsx` are now `docs/DESIGN-SYSTEM.md`; this layout reads in
  the `spoken` tone.
- **Net-first entry** and the 80-hour warning, in plain words.

## Known gaps

- No year navigation, no month scope picker, no per-job editor. All
  deliberate.

## Files

`TrackerPocket.tsx` · `src/styles/pocket.css`

## Rules

- Not yet on the palette system: colours are hardcoded in rules rather than
  tokens, so it follows light/dark but not the variant. Listed in
  `npm run theme:check` output.
- Subtraction is the feature. Anything added here has to displace something.
