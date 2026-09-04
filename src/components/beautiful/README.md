<!-- registry: order="0" group="Deciding what to do next" — the heading this
     layout sits under in the layout switcher and the review console. Read by
     vite.layouts-plugin.ts, which builds that list from these files so
     neither has a copy to keep. -->

# Big Beautiful

**One screen that answers what you can still earn, what you can still work, and what is coming — and lets you log a month without leaving it.**

## What it is for

The ninth layout, and the first one **built from a spec rather than
discovered**. The eight before it paid the discovery bill; this is what that
bought.

| | |
|---|---|
| **Mobile** | · built for it |
| **Desktop** | · holds up — a 672px column, centred |

## Where it came from

A three-round teardown of
[big-beautiful-design.lovable.app](https://big-beautiful-design.lovable.app),
a reference Sergey pointed at. It is the same product as ours — an SSDI income
tracker on the same $1,210 line — drawn better than any of our eight.

**Every measurement here was read off that page's live DOM, not guessed.**
That rule exists because it was broken twice in the session that produced this
file: month cards were built at 12px when the reference uses 26px, and the
editing state was invented as an unfolding panel when the real one turns the
row itself into a field. Both took one DOM read to correct and neither should
have needed correcting.

His instruction, after the second one:

> "Lets get the parity right first then we can diverge"
> "its not redesign its fitting and testuing and componantisation"

So the shape is the reference's. What diverges from it is listed below, and
each item is a decision he made or signed off.

## What it takes from the eight

Crossbred, not transformed — nothing is inherited by accident.

| From | Trait |
|---|---|
| `pocket` | The headline-and-consequence shape: a figure, then one sentence saying what it means, and nothing drawn between them. |
| `horizon` | The forward view — months as stops rather than a calendar — and its line budget. |
| `plan` | The safety line drawn **on** the scale rather than implied. `plan` argues that a reader should never have to estimate a proportion; the notch at `SAFE_MONTHLY` is that argument at meter scale. |

Deliberately **not** taken: `calc20`'s architecture (its `UiState` shim is the
reason its ideas get copied and its code does not), any annual chart, any
average, and any repeated summary strip.

## How it reads at a glance

The order of the screen is the order of the questions:

1. **How much is left** — the figure, the sentence, the meter, and what it is of.
2. **What that is of** — four tiles: counted this month, of your limit, months over, the year.
3. **What is coming** — the rest of the year as a scrolling strip, with the extra-paycheck months marked.
4. **What I can work** — the hours card.
5. **The record** — month by month, forward, tappable.
6. **The rule** — the limit, and where it came from.

**The hours card sits above the record, and that is the one structural change
from the reference.** Its calculator is sixth, below the month list. `CLAUDE.md
§ What the product is` says the product is a job-search calculator that later
becomes a record keeper, so the order is inverted here.

## The edit click style

Tapping a month does not open a sheet. **The row becomes the field** — the
month name drops to the caps label, a currency mark and one input appear under
it, and a round check sits at the end. Tapping away is the cancel, which is
why there is no second button. The check is the only save.

If there is no job yet, the first save creates one. With several jobs the
figure still writes to the job that already holds that month (or the first
job) — Big Beautiful is a one-number editor; per-job detail lives in
`MonthSheet` on the other layouts.

## Where it diverges from the reference, and why

| Divergence | Reason |
|---|---|
| The header names **which** limit | `$1,210` is the trial work line, and which line applies resolves per month. During the trial period, crossing it costs a month rather than a payment. |
| The meter carries a **notch at $1,000** and an estimate band | `SAFE_MONTHLY`. The reference's bar has one destination and it is the cliff. The pale run past the fill is the margin on figures worked out from a bank balance, drawn rather than hidden. |
| The hours ceiling divides by **the active limit** | Matches the reference: answer against $1,210 (or whichever line applies) and warn about extra-paycheck months in the footnote. |
| **Two tiles — per week and per month** | As the reference draws them. Semi-transparent on the green card, not white insets. |
| The extra-paycheck warning fires **on the month** | It was one clause of fine print six blocks away. |
| The month list runs **forward** | `scopedMonths(year, 'ahead')`. Twelve rows is the wall focus mode exists to remove; the months behind are one press away. |
| The limit field is **filled in** | `rules.ts` holds every year's figures and `trialWork.ts` picks which applies. Asking somebody to type their limit hands them the hardest question in the product. |

## Score

| | |
|---|---|
| Points | 89 / 129 |
| Primary features | 7 / 8 |
| Size | 506 lines TSX + 571 lines CSS |
| Value per 1k lines | **82.4 — second only to `horizon`** |

Budgeted at 1,150 lines before a line was written, per *lean code is a trait
too*, and came in at 1,077. The one primary it does not carry is **how sure
this is** — the estimate band is drawn on the meter but never stated in words,
which by the four graphic tests is the half that matters.

Run `npm run layouts -- beautiful horizon` for what differs from the leanest
layout in the product.

## Known gaps

- **The limit field is read-only.** Sergey asked for the field and it is here,
  filled and explained — but making it editable means storing an override of
  an SSA figure in `TrackerData`, which would change what every other layout
  computes. That is a bigger decision than a layout should make on its own and
  it is not made here. See `task-layout-nine-limit-override`.
- **No mileage or hours in the inline row.** A delivery month needs three
  numbers, not one, and the 80-hour rule needs a line beside the hours field.
  Both are specified and neither is built. See
  `task-layout-nine-gig-and-hours-not-built`.
- **No per-job editor of its own.** It borrows `MonthSheet` and `StreamSheet`,
  which is the intended answer, not a gap — but it means this layout has not
  earned an opinion about job editing yet.

## The theme

Ships with **`calm`**, a sixth palette variant: deep forest green `#00643a`
on warm paper `#fbfaf6`. Every colour is the reference's, resolved out of
`oklch()` into hex in `styles/palette.css` — the WebViews this app treats as
the floor cannot parse `oklch`, and an unparsed colour is not a fallback, it
is nothing.

The layout works on all six variants; `calm` is what it was drawn in.

## Rules

- **Measure before drawing.** Every dimension in `beautiful.css` came off the
  reference's computed styles. Do not adjust one by eye.
- **No literal values.** Every radius, control height and font size reads a
  token, so `npm run debt` passes on a file with no baseline. The layout adds
  zero design debt and must keep adding zero.
- **The frost is a budget, not a capability.** The flat fill is the floor and
  is complete on its own; `backdrop-filter` is added inside `@supports`.
- **One second line per row, and only when a month went over.** The reference's
  rows are one line. A dual line everywhere was tried and removed.

## Files

`TrackerBeautiful.tsx` · `BeautifulMonths.tsx` · `src/styles/beautiful.css`
