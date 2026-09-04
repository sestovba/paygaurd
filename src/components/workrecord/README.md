<!-- Written from the layout audit of 2026-09-03. The feature table is
     generated from the code, not from memory: see task-layout-audit in
     review/review-notes.json for the method and the scoring. -->

<!-- registry: order="4" group="The least on screen" — the heading this layout sits under in the
     layout switcher and the review console. Read by vite.layouts-plugin.ts,
     which builds that list from these files so neither has a copy to keep. -->

# Work Record

**The year as a grid, with the months that need you on top.** Renders inside
`.pg-payguard` and shares PayGuard's job editor.

## What it is for

**Density on a phone.** Nearly everything `overview` does, in half the code.

| | |
|---|---|
| **Mobile** | ★ pretty good |
| **Desktop** | ✗ does not hold |

> "in mobile is pretty good not on desktop"
> — the owner, on importance rather than rank

Borrows PayGuard's editor, which is why it is small — and why it inherits PayGuard's desktop bias.

**Importance is not the score.** The points table below measures *breadth* —
how many features this layout carries. It is useful for spotting gaps and
useless for deciding what matters. A layout can be last on points and be the
heart of the product; `pocket` is exactly that.

## What it contributes to a crossbreed

**Density that survives a small screen.**

Owner: *"in mobile is pretty good, not on desktop"*. It fits more real
information onto a phone than anything else here without becoming unreadable.

| Take | Leave |
|---|---|
| **The density model** — how much can be shown at once before a stressed reader loses the thread. Useful precisely because this audience is often told to choose between "readable" and "complete". | The desktop behaviour, which does not hold. |
| It already renders inside `.pg-payguard` and borrows that editor — evidence that sharing an editor across layouts works in practice. | |

> The eight layouts are **feature discovery**, not eight drafts competing. The
> next layout is built new from a spec that names the traits it takes — see
> `CLAUDE.md § Crossbreeding, not transforming`. Run `npm run layouts` for the
> trait matrix, or `npm run layouts -- workrecord <other>` to compare two.

## Owner's verdict

Not rated directly in the layout review. Its own screens carry several open
notes about noise — *"I am lost in the noise of the entire layout"*.

## Where it sits

**Phase 2 — recording.**

## Score

| | |
|---|---|
| Points | **111 / 129** — second highest |
| Primary features | 7 / 8 |
| Size | 839 lines TSX + 481 lines CSS |
| Value per 1k lines | **84.1 — the best of any full layout** |

That last number is the interesting one: it carries nearly everything
`overview` does in **half the code**, because it reuses PayGuard's editor
rather than owning one.

## What it has that others do not

- The highest feature density in the project.
- All three of the arithmetic primaries — mileage, the 80-hour cliff, and the
  net → before-tax conversion.

## Known gaps

- The reviewer's repeated complaint is noise, not absence: it says where you
  stand in three places at once.

## Files

`TrackerWorkRecord.tsx` · `WorkRecordMonths.tsx` · `WorkRecordStatus.tsx` ·
`src/styles/workrecord.css`

## Rules

- It draws inside PayGuard's shell. A change to `.pg-*` tokens lands here too.
- Its sub-theme defaults to the calc20 palette it was ported alongside, not
  PayGuard's own.
