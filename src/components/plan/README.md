<!-- Written from the layout audit of 2026-09-03. The feature table is
     generated from the code, not from memory: see task-layout-audit in
     review/review-notes.json for the method and the scoring. -->

<!-- registry: order="1" group="Deciding what to do next" — the heading this layout sits under in the
     layout switcher and the review console. Read by vite.layouts-plugin.ts,
     which builds that list from these files so neither has a copy to keep. -->

# Plan

**The flagship, and the reference shape.** One phone screen answering "what
can I do this month", in hours rather than dollars.

## What it is for

**Deciding in hours**, and framing trial months as permission rather than budget.

| | |
|---|---|
| **Mobile** | ★ built for it |
| **Desktop** | — not its viewport |

> "similar to pocket, they can cross polinate"
> — the owner, on importance rather than rank

Cross-pollinates with `pocket`. Same family, same voice, different question.

**Importance is not the score.** The points table below measures *breadth* —
how many features this layout carries. It is useful for spotting gaps and
useless for deciding what matters. A layout can be last on points and be the
heart of the product; `pocket` is exactly that.

## What it contributes to a crossbreed

**A graphic that reads without being learned.**

`plan`'s gauge already solves the problem every ring and arc in this product
runs into — a reader who sees a shape and asks *"what is this?"*. It solves it
four ways at once, and all four are portable:

| Take | Leave |
|---|---|
| **Countable chunks, not a continuous arc** — 12 discrete segments a reader can count instead of estimate. | The sprite ink, gilt and bevels — they are `@override plan` for a reason and do not travel. |
| **Patterns, not colours** — three fills that survive being printed in grey or seen by a colourblind reader. | |
| **Labels in place** — `data-safety-line` and `data-first-over` name themselves on the graphic, not in a legend. | |
| **Meaningful while empty** — `zoneOf` colours by position, so a month with no data still teaches what the shape means. | |
| **Answers in hours**, which is the unit the decision is actually made in. | |

These four are written up as the general test in `docs/DESIGN-SYSTEM.md § 1.5`.
`plan` is where they came from.

> The eight layouts are **feature discovery**, not eight drafts competing. The
> next layout is built new from a spec that names the traits it takes — see
> `CLAUDE.md § Crossbreeding, not transforming`. Run `npm run layouts` for the
> trait matrix, or `npm run layouts -- plan <other>` to compare two.

## Owner's verdict

> "plan has it right too"

Its look is argued, not decorative — see "Why plan looks like a Nintendo game"
in `docs/WORKING-WITH-SERGEY.md`. **Do not modernise it.**

## Where it sits

**Phase 2 — recording**, but it is the only Phase 2 layout that answers the
Phase 1 question, which is why the reframe leans on it.

## How the gauge works — and why it reads at a glance

**Do not rebuild this as a ring or an arc.** Every property below is load-bearing
and was arrived at by argument. A continuous proportional graphic loses all five.

| Property | Why |
|---|---|
| **Twelve discrete chunks**, not a continuous bar | You read "seven of twelve" instantly. Arc length has to be *estimated*, and estimating is the one thing this reader should never have to do. `SEGMENTS = 12`. |
| **Three patterns, not three colours** | Solid = counted · striped = margin of error · outlined = hours being tried. The comment in the file says it: *"Three patterns, so none of it depends on colour."* Colour-blind, low-vision and greyscale readers lose nothing. |
| **The lines are labelled where they sit** | `data-safety-line` and `data-first-over` put "Target amount $1,000" and "Do not cross $1,210" **on the gauge**. Added after a review note: a green rule with nothing on it was *"named only in a legend you had to match up by colour."* |
| **It means something while empty** | Colour comes from *where a chunk sits* (`zoneOf`), not from what is in it — so a new user with no data already sees where safe ends and caution begins. **This is the property a ring cannot have.** |
| **Four segments beyond the limit** | `OVER_SEGMENTS = 4`, so "over" has somewhere to render instead of pinning at full. |
| **It answers in hours** | The gauge is the evidence; "5 hours · you can still work safely" is the answer. |

The gauge also carries a full `aria-label` with the whole reading in words, so it
is not lost on a screen reader.

## Score

| | |
|---|---|
| Points | 86 / 129 |
| Primary features | 6 / 8 |
| Size | 1,055 lines TSX + 1,578 lines CSS |
| Value per 1k lines | 32.7 |

## What it has that others do not

- **Answers in hours** — shared only with `overview`. `capacityFor` does the
  translation and always rounds down.
- **The gauge**: twelve chunks, three patterns — solid counted, dithered the
  margin of error, outlined what you are trying. The margin is drawn, not
  hidden.
- **Individual paychecks** — shared only with `calc20`.
- Its own words for the trial months: *"Earn any amount, keep your payment.
  You get 9, and they do not come back."* This is the only layout that frames
  the trial period as permission rather than a budget to protect, and the
  product reframe says it is the one that has it right.

## Known gaps

- No months-that-need-you strip.

## Files

`TrackerPlan.tsx` · `src/styles/plan.css`

## Rules

- 16-bit, 1999, gilt. Square corners, hard 2px outlines, two-tone bevels.
  Sunken inputs, raised keys. Every pressable thing travels its full height
  and lands dead.
- Gilt triple-frames are reserved for things that **hold** something.
- Treasure island: each job is a chest, shut until it has paid into the month.
  Saved payments send coins **upward**.
- Rejected here and not to be re-proposed: a coin currency, whole-row
  gradients as progress.
