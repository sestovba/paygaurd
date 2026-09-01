# PayGuard

> ## ▶ START HERE: `review/REVIEW-NOTES.md`
>
> **That file is the brief.** It is the product owner talking about this app,
> screen by screen, in their own words. Read it before you read any code and
> before you propose anything — most of what looks like a free choice in this
> codebase has already been decided there, and the reasoning is in the note.
>
> The **"Owed to Claude"** section at the top of it is the work queue.

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
- **`done` is never asserted, only earned.** It is a claim about the code, so
  a note that still owes a change and has no reply saying it was made reads
  back as `sent`, whatever the word says.

`src/review/VOCABULARY.md` is the console's own dictionary — one word, one
meaning. If you add or rename a label, it goes there first.

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

- **Front end:** use the console itself. `L` selects, `C` comments, and the
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

- **This month only.** `UiState.focusMode` (default **on**) collapses every
  layout to the current month — no calendars, no charts, no year totals. A
  twelve-cell grid is a wall for this reader, and nobody keeps a benefits
  tracker current for a year.
- **The number people have is net.** Gross is what SSA counts and what almost
  nobody can find. Ask for what reached the bank and convert, out loud.
- **Answer in hours where you can.** Dollars are the unit the rule is written
  in; hours are the unit the decision is made in.
- **Aim at $1,000, not the limit.** `SAFE_MONTHLY` in `domain/rules.ts`. An
  extra paycheck month will clear a $200 margin without warning.
- **Miles are the 1099 lever.** $1,000 from a delivery app can be under $300
  countable once mileage comes off, and almost no driver knows it.
- **Say it plainly.** No jargon ("TWP", "1099", "gross"), no idioms, one idea
  per sentence, one-word labels where possible. The copy rules are written
  out at the foot of `src/components/pocket/TrackerPocket.tsx`.
- **If it needs explaining, it is designed wrong.** Prefer teaching by
  interaction — typing miles and watching the deduction appear beats a
  paragraph about the mileage rule.

## Where the truth lives

`src/domain/` is the source of truth and is shared by every layout. Fix
things there, not in a layout, and every screen gets it at once.

| File | Owns |
|---|---|
| `rules.ts` | SSA/IRS figures per year, the 80-hour rule, `SAFE_MONTHLY` |
| `earnings.ts` | What counts: gross, mileage, `nearLimit` |
| `trialWork.ts` | The 9 months in a rolling 60, and which limit applies |
| `capacity.ts` | Room in **hours**, the three stages, the estimate band |
| `months.ts` | `listedMonths()` — the one helper focus mode goes through |

There are ten layouts in `src/components/`. `plan/` and `pocket/` are the
reference shape; the older ones are being peeled back toward them. Shared
editors (`MonthSheet`, `StreamSheet`, `SettingsPanel`, `Sheet`) reach most
layouts at once, so a change there is worth more than a change in one screen.

`calc20/` keeps its own `UiState` shim in `calc20/state.tsx`. A new shared
preference must be added in four places there or it silently never arrives.

## Commands

```bash
npm run dev        # the app, and the review console with it
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + vite build
```

The review console is dev/localhost only and is never in a published build.
Open it with ⌘R or the button bottom-right. `L` selects, `C` comments.
