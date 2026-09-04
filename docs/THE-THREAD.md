# The thread

> **Why this file exists.** Sergey, September 2026: *"most of our sessions have
> been getting on the same page and train of thought."* That is the single
> largest recurring cost in this project — not bugs, not scope, but every new
> session re-deriving conclusions that were already reached, from code that
> shows *what* was decided and never *why*.
>
> Everything else answers a different question. `STATE.md` is generated facts.
> `REVIEW-NOTES.md` is the queue. `CLAUDE.md` is the rules. **This is the train
> of thought** — what we currently believe, and what changed our mind.

**Newest first. Append, don't rewrite.** A superseded entry gets a line saying
what replaced it; it does not get deleted, because "we already tried that" is
worth as much as "this is the plan".

---

## Where the thinking is right now

Five beliefs, in the order they constrain things:

1. **The product is a job-search calculator that later becomes a record
   keeper.** In that order. It was built the other way round.
2. **The audience is frightened.** Getting benefits was hard, the benefits are
   not enough, and the fear of losing them is the reason they are here. Calm,
   concise, gentle, not judging. Many are autistic, partially or fully blind,
   or not confident readers.
3. **The eight layouts are feature discovery**, not eight drafts competing.
4. **The ninth is crossbred from a spec**, not refactored out of one of them.
   It exists — `beautiful`, built 2026-09-04 — and what actually got it right
   was matching a reference before improving on it.
5. **Content is part of design.** The words are specified with the component
   that renders them, not in a document beside it.

---

## 2026-09-04 · The ninth exists, and it was built by matching first

**Believed before:** the ninth would be crossbred from a spec written out of
the eight — which is right, and turned out to be only half of how it happened.

**What actually produced it:** Sergey pointed at a reference —
`big-beautiful-design.lovable.app`, the same product as ours drawn better —
and the job became *fitting*, not designing. His words, after two rounds of my
mixing improvements into drawings that were meant to be matches:

> *"its not redesign its fitting and testuing and componantisation"*
> *"Lets get the parity right first then we can diverge"*

**The rule that came out of it, and it is the expensive one:** a rule from our
own design system is not a licence to deviate from a reference he has pointed
at. I replaced their progress bar with `plan`'s twelve chunks because a
continuous bar asks the reader to estimate a proportion. That reasoning is
sound and applying it there was still wrong. Match it, *then* argue.

**The second rule: measure, do not guess.** Twice I invented a value that one
DOM read would have given me — month cards at 12px where the reference uses
26px, and an editing state drawn as an unfolding panel when the real one turns
*the row itself* into the field. Both were visible to him instantly. Every
dimension in `beautiful.css` is now a measured value with a comment saying so.

**What it changed:** `beautiful` is in the codebase at 1,077 lines, 89 points,
82.4 per 1k — second only to `horizon` on leanness, and the first evidence that
budgeting the lines before writing them works. `CLAUDE.md` now says nine
layouts, and says the ninth is a different kind of thing from the eight.

## 2026-09-04 · Content is part of design

*"The copy on the site is superior but sometimes we say things better very
rarely — we need to change our content strategy."* And, when I put the copy
argument in its own section of a document: *"How should I put it, content is
part of design."*

**Believed before:** §1.2's four questions — which number, which period, of
what, so what — are each answered *in the label*.

**Believed now:** they are each answered *on the screen*. Together with §1.4's
"ask a question, do not name a field", the old reading loads four answers into
six words, and a label carrying four answers is a sentence wearing a label's
clothes. That is where *"Money they paid you"* came from.

The fix is the one Sergey picked out of the drawings himself — *"i like the
dual line"*. Line one is a short noun phrase; line two, muted, carries which
number and which period; "so what" leaves labels entirely and lives in one
sentence per screen. Nothing is lost.

**Two rules survive untouched** because they are about money and not tone:
round down always, and name only the limit that applies. Terser must never
become vaguer about which line you are near.

**Still owed:** §1.2 and §1.4 rewritten, and `copy.ts` following. This is the
one item from that session that touches every layout rather than the new one.
Recorded as `task-layout-nine-content-strategy`.

## 2026-09-03 · The glass is half empty

Sergey, correcting the new Pocket headline *"You can work about 46 more hours
this month"*: **"46 hours left"** — *"better framing… not permission to work
more but a limit approaching."* And then the principle itself: *"the glass is
half way empty."*

The number is the same and the instruction is the opposite. Everything this
app measures is being used up — the room in a month, the hours in a rate, the
nine trial months in a rolling sixty — so a figure that counts *up* toward a
limit describes progress toward the outcome the reader is afraid of, and
invites them to close the gap. Written as permission it quietly argues against
the reader.

It is the same finding as the ring analysis from earlier the same day, arrived
at from the words rather than the graphic: **a progress ring that fills toward
a limit is a completion metaphor pointed at a number you must not reach.**
Both halves are now one rule.

**What it changed:** `DESIGN-SYSTEM.md § 1.5 Every quantity is what is left`,
and `hoursLine` in `domain/copy.ts`. Pocket now reads "46 hours left this
month" over "$993 left before the $1,000 we aim for" — every figure on the
screen a remainder.

**The exception, stated in the rule:** trial work months are a protection the
rule grants rather than a resource being burnt, so they are said as what is
still available. The test is not optimism, it is whether the reader is being
told what they still have or how close they are to the edge.

## 2026-09-03 · The device rules are a floor, not a ban

**Believed before:** `color-mix()`, `backdrop-filter`, web fonts and blurred
shadows were prohibited outright, on the grounds that the audience is on old
Android WebViews.

**Believed now:** Sergey — *"Pocket can be progressive design meaning fonts
fall back… we can say, does this browser support this property? load fonts,
no? don't load. Its a simple js check."* And on the absolutism: *"back in the
days it was true about rounded corners."*

He is right, and the source already agreed with him before anyone said it:
the ban was being violated **144 times** by `color-mix()` across all eight
stylesheets and **89 times** by `backdrop-filter` — including in `plan` and
`pocket`, the two layouts the rule named as its reference. Meanwhile
`payguard.css:1598` had independently arrived at the correct pattern,
`@supports not (backdrop-filter: …)`, and nothing anywhere documented it.

The rule was also three problems in one sentence: **support** (free to answer,
`@supports`), **frames** (a budget, not a capability — support is not
permission), and **bytes** (`font-display: swap` and
`navigator.connection.saveData`, nothing to do with either).

**What it changed:** `CLAUDE.md § The device is the floor, not the ceiling`
and `DESIGN-SYSTEM.md § 1.8`. The floor is unchanged and non-optional — every
surface complete with no `@supports` block ever matching. Above it, the better
rendering is free, and withholding it costs the majority of readers something
and buys the minority nothing.

## 2026-09-03 · The eight layouts are a gene pool

**Believed before:** the eight layouts were redundant, and the job was to
consolidate them toward `plan`/`pocket`. `CLAUDE.md` carried a section called
*"One layout, or an option on one?"* framing them as a merge backlog.

**Believed now:** *"My goal for many layouts is feature discovery. They are
unique, but building a new layout we can control the spec and cherry pick the
wanted features and build that and not transform something. We are
crossbreeding layouts — and functionalities. But there's things to
cross-pollinate also."*

So the duplication was never waste; it is what makes the comparison possible.
Eight parallel attempts found eight different things, and the value is in
knowing which. Two operations follow, and they are different jobs:

- **Crossbreed** — forward, into a new layout written from a spec that names
  the traits it takes.
- **Cross-pollinate** — sideways, a proven trait into its cousins. This is the
  existing *"a comment is a direction, not a local edit"* rule under its
  proper name.

**What it changed:** the `CLAUDE.md` section is now *"Crossbreeding, not
transforming"*. `npm run layouts` was written the same day so the trait table
is a command rather than an audit.

## 2026-09-03 · Spec first, because refactors are costly

*"Which is why its good to make it right the first time, refactors are
costly."* The eight layouts already paid the discovery bill. What that buys is
the ability to write down in advance what the ninth does — a decision in a spec
costs a sentence, the same decision after the code exists costs the code.

`calc20` is the standing proof: nothing is wrong with what it *does*, and it is
still the layout nobody wants to touch.

## 2026-09-03 · Lean code is a trait, not hygiene

*"To make better layouts we need good engineering practices I believe that,
lean code on all layouts."*

The **per 1k lines** column in `npm run layouts` is the score. `horizon` gets
140.8 points per 1,000 lines; `calc20` gets 7.7. A trait that only works
because of 4,000 lines of scaffolding did not actually work — take the idea,
rebuild it lean, and if it cannot be rebuilt inside a sane budget, that is a
finding about the trait.

## 2026-09-03 · A screenshot is a specification

*"When I provide a screenshot that is what I want the way it is… my
expectation is something very similar not worse but hopefully better."* And:
*"I have seen worse often."*

Match it, then improve it. Different-but-interesting is a failure. Written up
in [`WORKING-WITH-SERGEY.md § A screenshot is a specification`](WORKING-WITH-SERGEY.md).

## 2026-09-03 · The audience is scared, and the copy has to know it

*"These people are under a lot of stress, getting benefits was very hard and
they are panicking and the benefits are not enough which is why they look for
work but they are scared to lose their benefits."*

*"We also need to be calm, concise, peaceful, gentle, understanding, not
judging and careful."*

*"Most of the users are not high IQ, they could be autistic, they could be
partially blind or fully blind."*

*"We need to chew their information and spoon feed through progressive and
timely disclosures."*

**What it changed:** `docs/DESIGN-SYSTEM.md` grew §1.6 — a graphic must be
readable without being learned (labelled in three words? meaningful while
empty? survives losing colour? states its value in words?). This is also why
`plan`, `pocket` and `horizon` — the three that refuse to draw a chart — are
the three rated highest.

**Still owed:** the actual sentences for each moment in the disclosure map.
The trial-work reassurance copy needs a benefits counsellor's sign-off and
**must not ship on an AI's say-so**.

## 2026-09-03 · The product was reframed

The owner's own route in: he got SSDI, heard about the rules, asked an AI what
they meant, and realised **his job-search criteria depended on the answer** —
what rate, how many hours, what schedule to even apply for. It is always
part-time. He did not have the variables.

Two phases, one question between them, asked right after onboarding and never
buried in Settings: **"Are you working, or actively looking for work?"**

The simulator is the front door. Today it is `SafeWorkSimulator`, reachable
through Settings, and that is backwards. Full detail in `CLAUDE.md § What the
product is`.

**Also decided:** the tool runs both ways. `rate → hours` exists in
`capacity.ts`; **`hours → rate`** — *"I can manage 10 hours, what can I be
paid?"* — is the actual job-search criterion and exists in no layout.

## 2026-09-03 · The theme overlay was the wrong move — reverted

An assistant read a handoff of mine that said *"land it in `SafetyHero.tsx`
first"* and built a theme layer on top of `payguard`. Sergey: *"not good lets
revert it that was the wrong way to do it… we want a clean, modern new design
built right from the start."*

Reverted; the parts are in `scratchpad/reverted-theme-overlay/`.

**The lesson is upstream of the mistake:** the September redesign work was
*requirements gathering and component design*. Turning that into a patch on an
existing layout skipped the step where the spec gets written. This entry is
what "crossbreed from a spec, don't transform" is reacting to.

## Standing corrections — things that keep being got wrong

- **The repo is the iCloud path in `CLAUDE.md`.** Not Dropbox, and not
  `/Users/Sergey/Code/paycheck-guard` — two archived handoffs said that and it
  cost a session.
- **A grep finds the strings you wrote, not the ones the app renders.** Twice
  in one session a source scan declared a surface clean and the running app
  disagreed (`W2`, `260mi`). `npm run words` says so in its own output.
- **Never call visual work done from a passing typecheck.** Open the app.
- **The score is breadth, not fitness.** `pocket` is last on points and is the
  heart of the product.
