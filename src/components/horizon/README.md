<!-- Written from the layout audit of 2026-09-03. The feature table is
     generated from the code, not from memory: see task-layout-audit in
     review/review-notes.json for the method and the scoring. -->

<!-- registry: order="2" group="Deciding what to do next" — the heading this layout sits under in the
     layout switcher and the review console. Read by vite.layouts-plugin.ts,
     which builds that list from these files so neither has a copy to keep. -->

# Horizon

**The months you have left, what lands in them, and what to do about it.**

## What it is for

**The forward view** — the only one. Month/job/status sheets, the hours simulator, and the month-scope picker are wired through shared components.

| | |
|---|---|
| **Mobile** | · workable |
| **Desktop** | · workable |

> "incomplete lacking features in my opinion"
> — the owner, on importance rather than rank

Most efficient code in the project and the least finished. Both are true.

**Importance is not the score.** The points table below measures *breadth* —
how many features this layout carries. It is useful for spotting gaps and
useless for deciding what matters. A layout can be last on points and be the
heart of the product; `pocket` is exactly that.

## What it contributes to a crossbreed

**Leanness, and the forward view.**

**639 lines. 140.8 points per 1,000 — the leanest thing in the product by a
wide margin, and 18× leaner than `calc20`.** When the rule is *lean code on
all layouts*, this is the benchmark that proves the budget is achievable.

| Take | Leave |
|---|---|
| **The line-count discipline.** Whatever a trait costs elsewhere, horizon is the evidence it can cost less. | Leaving the runway lean — add act surfaces by reusing shared sheets, not by growing a private editor. |
| The **forward view**: months ahead as stops, with a NOW pill locating the reader on it. This is the only layout built around what is coming rather than what happened. | |
| Its legend, which is **built from the fills actually present** rather than listing every state that could exist. | |

> The eight layouts are **feature discovery**, not eight drafts competing. The
> next layout is built new from a spec that names the traits it takes — see
> `CLAUDE.md § Crossbreeding, not transforming`. Run `npm run layouts` for the
> trait matrix, or `npm run layouts -- horizon <other>` to compare two.

## Owner's verdict

> "horizon is incomplete, I dont know what to say"

That is the clearest signal in the layout review: nobody can review what is
not finished.

## Where it sits

**Phase 2 — recording**, forward-looking end.

## How it reads at a glance

A row of **month stops**, each carrying its own state — not a chart of the year.
Same family as `plan` and `pocket`: it refuses continuous proportional graphics
and gives each month a discrete, labelled place instead.

Two details worth keeping if it is ever rebuilt:

- The current month is a neutral **NOW** pill inside the label, never a coloured
  ring — a ring in the safe colour made an over-limit month read green.
- The legend is built from the fills **actually on the track**, so it cannot name
  a limit the reader is not under.

## Score

| | |
|---|---|
| Points | 90 / 129 |
| Primary features | 7 / 8 |
| Size | 351 lines TSX + 288 lines CSS |
| Value per 1k lines | **140.8 — by far the highest in the project** |

Worth sitting with: the layout the owner cannot review is the most efficient
one written. It has 7 of 8 primaries in 639 lines. `calc20` has 5 in 11,677.

## What it has that others do not

- **The runway** — the only forward-looking surface in the product, and the
  one that best matches the new default month scope ("the rest of the year").
- The one-limit rule applied through `LIMIT_NAME` rather than re-derived.

## Known gaps

- Job and month CRUD go through the shared `StreamSheet` / `MonthSheet`;
  benefit status through `TwpWizard`; hours through `SafeWorkSimulator`;
  month range through `MonthScopePicker` — same parts counterparts use, not
  private forks.
- Still no **two-way** hours answer (*"I can manage 10 hours, what can I be
  paid?"*) — that gap is product-wide, not Horizon-only.

## Files

`TrackerHorizon.tsx` · `HorizonRunway.tsx` · `src/styles/horizon.css`

## Rules

- The current month is a neutral `NOW` pill inside the month label, never a
  coloured ring — a ring in the safe colour made an over-limit month read
  green.
- Its legend is built from the fills actually on the track, so it cannot name
  a limit the reader is not under.
