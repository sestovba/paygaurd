# Working with Sergey

One file. Only things that change a decision — if a line here wouldn't change
what you do, it shouldn't be here.

Clustered by impact: §1 applies to every message, §2 to every edit, §3 is rare
but expensive to get wrong, §4–6 are reference.

---

# 1 · Before you answer anything

## His words have fixed meanings

| He writes | It means |
|---|---|
| **"Why is …"** | **A change request.** "This feels wrong — do it differently." Answering with the reason and stopping is a non-answer. |
| **"I need a fix"** | It is broken. Repair, return, one line. No preamble. |
| **"Do it"** | Implement. Stop proposing. |
| **"MD rule"** | Write it into this file, not just the code. |
| **"Polish pass"** | Values only — spacing, type, colour, radius, shadow, alignment. Never a redesign. |
| **"Fix ownership"** | The rule is in the wrong place. Move it to the right owner. |
| **"Low hanging fruit"** | Safe only. Nothing structural. |
| **"align"** | Rendered pixels from the viewport edge, not equal padding. → §4 |
| Praise — *"very reassuring"*, *"good placement"* | **Do not touch this.** Say it's untouched and move on. |

## Answer shape

Action first, one line of reasoning, depth only when asked.

> Fixed. The header gear starts at `md` now — it was `lg`, and the bottom bar
> that carries Settings is `md:hidden`, so 768–1023px had no way in at all.

## Never start what you cannot finish

Finished is four things: **code changed + typecheck passes + verified in the
running app + review note replied.** Size against all four.

| Budget used | Posture |
|---|---|
| **under 50%** | No budget thinking. Take the scope the request implies. |
| **50–70%** | Prefer finishing open work to starting new. Don't begin what you can't estimate. |
| **70–85%** | Only start what fits *with room to verify and write up*. Split big asks; say which piece you're doing. |
| **85–95%** | Land what's open. Close every loop. No new fronts. |
| **95–99%** | Stop implementing. Write the rest as `task-…` notes and **ask whether he wants it done now.** |
| **over 99%** | Handoff only. |

A half-applied change is worse than an unstarted one: a primitive with its old
callers still in place is two systems, a shared component rewritten without
its cousins is drift, and a note marked `done` with nothing behind it is a lie
the next session believes.

**Splitting beats stopping.** If budget runs low mid-change, finish the
smallest coherent unit — the domain rule without the ten call sites — get it
typechecking, note the rest, say which piece landed.

## When instructions conflict

- **He contradicts this file** → he wins. Update the file in the same pass.
- **Two of his notes contradict** → the later wins. Don't re-litigate the
  earlier one or point out that it changed.
- **He asks for something that breaks a locked rule** → do every unaffected
  part, state the conflict in one or two sentences, proceed under a stated
  reading. If it touches the SSDI maths in §3, stop and ask instead.
- **Ambiguous** → pick a reading, act, and say which reading in one sentence
  so he can overrule it cheaply.

## Worked examples

| He says | Wrong | Right |
|---|---|---|
| *"Why is the thead click area smaller than the rows below?"* | Explain the token values. | Fix the header hit geometry. Report in one line. |
| *"1023px wide missing gear icon"* | Add a breakpoint at 1023px. | Find why — gear was `lg:grid`, bottom bar `md:hidden`, so 768–1023 had no entry at all. Fix the band. |
| *"Do what you think is best I trust your judgement"* | Ask which he'd prefer. | Decide, do it, say why in one sentence, offer the reverse. |
| *"wcddwc"* | Guess. | Say it isn't actionable, describe what the element is now, ask. |
| *"Very reassuring"* | Improve it. | Leave it. Say it's untouched. |
| A note on v2's `SafetyHero` | Patch v2. | It's shared — fix once; classic and responsive get it too. |

---

# 2 · Before you change anything

## A comment is a direction, not a local edit

His words: *"instead of treating them as precise edits on that layout, treat
them as holistic comments … ask, can this request be project wide?"*

One note on one screen is usually the same instruction as three notes on three
others. Order: **the screen it landed on → the cousin layouts that share the
component → a second pass for anything genuinely global.**

Cousins that share nearly everything: **classic, v2, responsive**. One edit to
`SafetyHero`, `MonthGrid`, `StreamSheet`, `Sheet` or `SettingsPanel` serves
all three.

## Fix it where it lives

`src/domain/` is the source of truth for all ten layouts. Fix a rule there and
every screen gets it; fix it in a layout and you've made the ninth copy.

When you build a shared primitive, **rewrite the existing callers onto it in
the same pass** — a primitive with the hand-rolled copies still around is two
systems, not one.

## Short requests are surgical

Change the named thing. Preserve unrelated styling, behaviour and state. Don't
refactor for cleanliness alone; don't reopen a settled decision because you
were nearby. Broaden only when the result can't be done correctly at the named
level — and say you're doing it.

A refactor he *asks* for allows wider cleanup, but behaviour stays locked.
Cleaner declarations aren't a successful refactor if the rendered result moved.

## Verify it yourself

Typecheck is not evidence. Spacing, colour, hover/focus feel, motion and
anything claiming to be aligned need eyes on the running app.

**Do not ask him to go and look** — he asked you to build it so he wouldn't
have to. Open the app, measure, screenshot, say what you saw.

---

# 3 · Where being wrong is expensive

Everything below costs a real person money or benefits if it's wrong. This is
the section to be slow in.

## Ask, don't guess

Four calculation questions have been open across every version of this
product. They are unresolved by choice. **Do not change any of them without a
decision from Sergey** — do the rest of the task, then raise the specific
choice.

- **Trial-work money-test basis** — stated as gross plus the self-employment
  hours test, but implementation history may synthesise W-2 and
  self-employment counted values differently.
- **Self-employment averaging** — across twelve months, or only active
  months? Copy and code have disagreed.
- **Direct countable override** — if ever enabled: explicit, reversible,
  preserves underlying detail, survives import/export.
- **Unknown future years** must never silently inherit the previous year's
  thresholds.

## Round down, always

Ten and a half hours of room reports as ten. Wrong downward costs a few hours
of pay that can be taken next month; wrong upward costs a debt to Social
Security.

## One limit at a time

Name the limit that applies and never the one that doesn't. In the trial work
period, the substantial-work limit isn't mentioned; once the nine months are
used, the trial work period is never mentioned again. Everywhere else it is
"your limit" — unambiguous *because* the reader is never shown the other one.

**No abbreviations on screen.** TWP and SGA don't appear. `src/domain/copy.ts`
is the vocabulary and deliberately has nowhere to type them; the full list of
banned words, with reasons, is `NEVER` in that file and Part 1.3 of
[`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md).

## Combined consequence belongs to the summary

A per-source view shows only source-owned facts — hours, gross, miles,
deductions, that source's countable amount. **A single source must never show
a TWP or SGA "impact"**, because it implies a conclusion that is false as soon
as other income exists.

---

# 4 · Craft rules for this product

Generic web craft isn't here. These are the ones this product gets wrong.

## Alignment

**Alignment is the final rendered pixel from the viewport edge.** Not equal
`padding-left` declarations.

> final edge = page offset + margins + borders + paddings + nested offsets +
> local offset

Two elements may need **different** local values and still be aligned, because
their ancestor chains differ — and identical local values can be visibly
misaligned for the same reason. When several elements share an edge, move it
to **one owner or token**, don't compensate per child.

**Test:** `getBoundingClientRect()` in the browser. Not reading the stylesheet.

He had to explain this more than once, and answered by promoting it into all
seven of his context files at once.

## Flat structure

A container earns its place by owning something real: semantics, layout,
state, accessibility, clipping, or a surface that improves comprehension.

> **Test:** if removing it changes nothing except simplifying the DOM, remove
> it.

No card inside a card. No panel inside a panel for spacing. Prefer spacing and
surface contrast over borders and dividers.

## Reversible, not interruptive

Destructive removal is immediate and restores to its **exact prior position**.
No confirmation dialog where reliable Undo exists. Reserve confirmation for
actions that change the meaning of existing data — e.g. switching an income
source's type once it holds entries.

---

# 5 · Settled — don't reopen

Assume these hold unless he explicitly changes direction or a regression
appears. A local tweak is never permission to reopen one.

- Current month first, then prior months descending. Future months hidden by
  default; an explicit override reveals them.
- **Month eligibility resolves before sorting.** A sort must never reveal a
  future month.
- Focus mode (`UiState.focusMode`, default on) collapses every layout to the
  current month.
- **The benefit phase resolves per month**, not once at year end. A trial work
  period ending in June means July is judged against the other limit.
- Aim at `SAFE_MONTHLY`, not the limit. Thresholds live in
  `src/domain/rules.ts` — never scatter them into layout code.
- Self-employment deductions reuse the existing persisted state. Mileage stays
  separate and rate-based.

## Why `plan` looks like a Nintendo game

`plan` is the flagship and the reference shape. Its look is argued, not
decorative — do not "modernise" it.

- **Answers in hours, not dollars.** The other layouts report a figure; the
  decision is *"can I take Saturday's shift"*. `src/domain/capacity.ts` does
  the translation and always rounds down.
- **A game gauge, not a chart.** His reason: *"we need a video game like
  gauge — disabled people love Nintendo."* Twelve chunks, three patterns —
  solid = counted, dithered = margin of error, outlined = what you're trying —
  a safety line at `SAFE_MONTHLY` and a heavier line at the real limit.
- **The margin of error is drawn, not hidden.** An 8% band on net-derived
  figures, not a larger silent one: the net→gross conversion already leans
  high and the visible safety line is the real protection. A third hidden
  margin just deletes hours the person was allowed to work.
- **16-bit / 1999 / gilt.** Square corners, hard 2px outlines, two-tone
  bevels. Sunken inputs vs raised keys — a thing you type into looks like a
  hole, a thing you press looks like it stands up. Gilt triple-frames are
  reserved for things that *hold* something. Every pressable thing travels its
  full height and lands dead, no easing: buttons should be *"desirable to
  press."*
- **Treasure island.** Each job is a chest, shut until it has paid into this
  month. Saved payments send coins **upward** — falling coins read as loss.

## Rejected — do not re-propose

- **A coin currency.** A counter was built and removed: *"let's not give them
  coins that are unrelated to their earnings — it's mixing."* A fake balance
  beside real dollar figures on a benefits app is a hazard. Coins survive only
  as a transient cheer.
- **Whole-row gradients as progress.** Progress belongs to the number it
  explains.
- **Explaining Social Security to the reader.** *"I don't need to know about
  social security's opinions, I just need to be able to generate my own
  opinion."*
- **Long explanatory paragraphs.** *"A long explanation is a symptom of bad
  design."* Teach by interaction instead.
- **A dashboard added to surface hidden state.** Prefer compact labels and
  native disclosure.
- From earlier builds: a dark-glass header redesign; direction-sensitive
  hide/reveal chrome on scroll; replacing the information architecture during
  a polish pass.

---

# 6 · Upkeep

**Repeated corrections become doctrine.** Corrected twice on the same class of
thing? The fix isn't another patch — write the rule here and say you did.

**Record rejections** in §5 so they don't come back in six weeks.

**When a decision becomes durable it goes in this file in the same pass as the
code.** If the code and this file disagree, one is wrong — fix it, don't leave
the contradiction standing.

## Other assistants commit here

He runs more than one AI on this repo and their commits all carry his git
identity, so `git log --author` proves nothing. Two tells that work for
scoping an audit:

- **Commit vocabulary.** This repo's own history is prose — *"Review console:
  one word, one meaning"*. Another model wrote conventional commits —
  *"feat:"*, *"refactor(x):"*.
- **A `backup: state before …` commit** cleanly marks where another session
  started.

Judge by reading the diff against this file and the review notes, not by
attribution. **Verify every `done` claim against the code** — false *"Verified
…"* replies on untouched files were the most common defect found last time,
which is why `REVIEW-NOTES.md` now self-checks them.

---

Voice, the master vocabulary and the per-layout tone variants are in
[`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) — §4 above is pixels, that file is
words, and neither repeats the other. Orientation, the review protocol and
the audience constraints are in [`CLAUDE.md`](../CLAUDE.md). The live queue is `review/REVIEW-NOTES.md`; where
things stand right now is [`STATE.md`](STATE.md) (`npm run state`).
