<!-- Written from the layout audit of 2026-09-03. The feature table is
     generated from the code, not from memory: see task-layout-audit in
     review/review-notes.json for the method and the scoring. -->

<!-- registry: order="5" group="The least on screen" — the heading this layout sits under in the
     layout switcher and the review console. Read by vite.layouts-plugin.ts,
     which builds that list from these files so neither has a copy to keep. -->

# Calc20

**Twelve squares and a running total.** Its own design system, its own state
shim, and a separate single-file build.

## What it is for

**The feel.** Smoothest front end in the product, by the owner's own measure.

| | |
|---|---|
| **Mobile** | ★ built for it |
| **Desktop** | ★ holds up |

> "most impressive and smooth front end experience"
> — the owner, on importance rather than rank

Its value is the interaction quality, which is portable. Its cost is the architecture, which is not.

**Importance is not the score.** The points table below measures *breadth* —
how many features this layout carries. It is useful for spotting gaps and
useless for deciding what matters. A layout can be last on points and be the
heart of the product; `pocket` is exactly that.

## What it contributes to a crossbreed

**The feel. Only the feel.**

The owner's words: *"most impressive and smooth front end experience"*. Both
halves of the usual verdict are true at once — its **value is interaction
quality**, which is completely portable, and its **cost is architecture**,
which is not.

| Take | Leave |
|---|---|
| The interaction quality — the responsiveness, the transitions, the way input feels answered rather than accepted. | **Its own `UiState` shim** (`calc20/state.tsx`). A new shared preference must be added in four places or it silently never arrives. |
| `NumericExprInput` — typing `40*21.5` and getting an answer is the kind of small competence this audience is rarely given. | **Its glass system.** 101 hardcoded colours, outside the palette, and `color-mix()` is banned on the target device. |
| Progressive disclosure done well. | **11,677 lines for 90 points — 7.7 per 1k, worst in the product by 2.5×.** |

**This is the cautionary entry.** Nothing calc20 does is wrong; it is simply
the layout nobody wants to touch, which is exactly what "make it right the
first time" is trying to avoid repeating.

> The eight layouts are **feature discovery**, not eight drafts competing. The
> next layout is built new from a spec that names the traits it takes — see
> `CLAUDE.md § Crossbreeding, not transforming`. Run `npm run layouts` for the
> trait matrix, or `npm run layouts -- calc20 <other>` to compare two.

## Owner's verdict

> "calc has a nice design and smooth to use, but is brittle and hard to
> maintain"

Both halves of that are visible in the numbers below.

## Where it sits

**Phase 2 — recording.**

## Score

| | |
|---|---|
| Points | 90 / 129 |
| Primary features | 5 / 8 |
| Size | 5,467 lines TSX + **6,210 lines CSS** = 11,677 |
| Value per 1k lines | **7.7 — worst in the project by 2.5×** |

It costs more than `overview` and `workrecord` **combined** and delivers less
than either.

## What it has that others do not

- **Work expenses (IRWE)** — the only layout, anywhere.
- **Expression input** — type `8×5` in a money field.
- Glass and density controls.
- Individual paychecks, shared only with `plan`.

Three of those four are bonus-tier: pleasant, and nothing depends on them.

## Known gaps

- **No per-month entry through the shared mutator** — it has its own.
- No months-that-need-you strip, no notifications.
- No mileage deduction in the entry path.

## Files

29 `.tsx` files in this folder · `src/styles/calc20.css`

## Rules

- **It keeps its own `UiState` shim** in `state.tsx`. A new shared preference
  must be added in four places there or it silently never arrives. This is the
  single largest maintenance tax in the project.
- Not on the palette system: 101 colours and its own glass treatment. Listed
  in `npm run theme:check` output.
- `npm run build:calc20` produces `dist-calc20/calc20.html` — a handover
  format, one self-contained page, no sign-in and no review console. It is not
  a second deploy.
- The layout is capped at `--c20-max` (760px). One value, one edit.
