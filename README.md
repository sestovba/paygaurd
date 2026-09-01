# PayGuard

An earnings tracker for people working while on SSDI/SSI. It answers one
question — *can I take this shift without putting my payments at risk?* — and
answers it in hours, because that is the unit the decision is made in.

## → The brief is `review/REVIEW-NOTES.md`

**Read that first.** It is the product owner reviewing the app screen by
screen, and it is where the design decisions and the reasoning behind them
live. The "Owed to Claude" section at the top is the open work.

Working on this with an AI assistant? [`CLAUDE.md`](CLAUDE.md) is the
orientation: the review protocol, the audience constraints that are not
negotiable, and where in `src/domain/` the truth actually lives.

## Running it

```bash
npm install
npm run dev
```

The in-app **review console** starts with it — dev and localhost only, never
in a published build. Open it with ⌘R or the button bottom-right; `V` selects
an element, `C` comments on it. What you write lands in `review/` as both
JSON and a readable report, and is committed with the code.

## Layout of the code

- `src/domain/` — the rules. Shared by every layout; fix things here.
- `src/components/` — ten layouts. `plan/` and `pocket/` are the current shape.
- `src/review/` — the review console itself.
- `review/` — the notes. The conversation about the product.
