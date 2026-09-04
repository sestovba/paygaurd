# PayGuard

An earnings tracker for people working while on SSDI/SSI. It answers one
question — *can I take this shift without putting my payments at risk?* — and
answers it in hours, because that is the unit the decision is made in.

## → Start with `docs/THE-THREAD.md`

**The train of thought.** What this project currently believes and what changed
its mind, newest first. It exists because the largest recurring cost here is
each session re-deriving conclusions already reached — code shows *what* was
decided and never *why*.

## → The brief is `review/REVIEW-NOTES.md`

**Read that first.** It is the product owner reviewing the app screen by
screen, and it is where the design decisions and the reasoning behind them
live. The "Owed to Claude" section at the top is the open work.

Working on this with an AI assistant? [`CLAUDE.md`](CLAUDE.md) is the
orientation: the review protocol, the audience constraints that are not
negotiable, and where in `src/domain/` the truth actually lives.

## How to work on this

**[docs/WORKING-WITH-SERGEY.md](docs/WORKING-WITH-SERGEY.md)** — one file,
clustered by impact, holding only what changes a decision.

1. **Before you answer anything** — what his words mean (*"Why is …"* is a
   change request, not a question), the answer shape, and the rule that you
   never start what you cannot finish in the session budget left.
2. **Before you change anything** — a comment is a direction, not a local
   edit: fix the rule in `src/domain/`, then carry it to the cousin layouts.
3. **Where being wrong is expensive** — the trial-work and self-employment
   calculation questions that need a decision rather than a guess.
4. **Craft rules for this product** — alignment measured from the viewport
   edge, flat structure, reversible over interruptive.
5. **Settled, and rejected** — what not to reopen and what not to re-propose.

It replaces the SGA Tracker context packs that preceded this codebase, and is
meant to be updated in the same pass as the code rather than in a follow-up
that never happens.

## Reports

Four read-only commands. Each answers a question that otherwise costs a fresh
audit every session:

```bash
npm run state     # branch, uncommitted work by area, open queue count
npm run layouts   # the layout trait matrix, with a leanness score
npm run words     # banned vocabulary still in a user-visible string
npm run review    # regenerate REVIEW-NOTES.md from the JSON
```

`npm run layouts -- plan pocket` compares just those two. `npm run words --
--check` and `npm run review:check` exit non-zero, so either can gate a build.

## Running it

```bash
npm install
npm run dev
```

The in-app **review console** starts with it — dev and localhost only, never
in a published build. Open it with ⌥R or the button bottom-right; `D` selects
an element, `C` comments on it. What you write lands in `review/` as both
JSON and a readable report, and is committed with the code.

## Layout of the code

- `src/domain/` — the rules. Shared by every layout; fix things here.
- `src/components/` — nine layouts. Not nine drafts of one app: eight
  explorations, each good at something the others are not. See CLAUDE.md.
- `src/review/` — the review console itself.
- `review/` — the notes. The conversation about the product.
