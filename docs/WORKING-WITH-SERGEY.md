# Working with Sergey

Read this before your first change. It is not style advice — it is the
contract, and most of it was learned the expensive way.

It was consolidated from the SGA Tracker context packs (v141 → v143) and the
usability pack (v193), which are earlier codebases of this same product. The
class names and pixel values in those packs belong to those builds and are
**not** law here. Everything on this page is.

---

## 1. Classify the request before touching anything

Two axes, decided before you open a file.

**What kind of change is it?**

| Type | Means |
|---|---|
| CSS | colour, spacing, radius, shadow, hover/focus, responsive presentation, transitions |
| HTML/JSX | structure, semantics, wrappers, labels, native attributes |
| JS — simple | one local event, a toggle, a derived display value with an obvious owner |
| JS — complex | persistence, calculations, cross-component state, import/export, auth, undo, month ordering/visibility |
| Product | a requirement, an invariant, a priority, a terminology decision |
| Content | naming, messaging, explanatory copy |

**How deep does it go?**

- **Quick / surgical** — find the owner, change only that owner, one
  proportional check, return. Most requests are this.
- **Functional / moderate** — inspect the owning component or state, make the
  smallest systemic fix, check the neighbours it touches.
- **Complex / multi-pass** — requirement → ownership → implementation →
  regression → edge cases → runtime validation. Reserved for calculations,
  persistence, undo, auth, and the SSDI domain rules.

**Do not broaden.** A CSS request does not become a JS review. A local
structural request does not become an architecture pass. Do not inspect or
modify a system just because it happens to sit in the same file.

And do not apply complex-work ceremony to a one-line change. The analysis
should be proportional to the *risk of the change*, not to the size of the
codebase.

## 2. Wear only the hat the request needs

Designer (hierarchy, spacing, colour, motion, feel) · Developer
(correctness, ownership, state, regressions) · Product Owner (requirements,
scope, what is already locked) · User (friction, cognitive load, mobile) ·
Marketing/Content (labels, messaging, clarity).

A 1px tweak needs the Designer hat alone. A persistence bug needs Developer +
Product Owner. A confusing label needs User + Content. Running everything
through all five is how a small request becomes a long answer nobody asked
for.

## 3. What his words mean

This vocabulary is stable and load-bearing. Getting it wrong is the most
common way to waste his time.

| He writes | It means | Do |
|---|---|---|
| **"Why is …"** | **A change request, not a question.** "This feels wrong or inconsistent — do it differently." | Change it. Explain only if he asked for reasoning alone. |
| **"I need a fix"** | It is broken. | Repair it, return it, one line on what changed. No preamble. |
| **"Do it"** | Stop proposing. | Implement. Do not brainstorm first. |
| **"MD rule"** | This is now durable. | Write it into the source-of-truth docs, not just the code. |
| **"Polish pass"** | Values only. | Spacing, type, colour, contrast, radius, shadow, alignment, low-risk motion. **Never a redesign.** |
| **"Fix ownership"** | The rule is in the wrong place. | Move it to the correct component/token/state owner. |
| **"Non-regression"** | Permanent. | Preserve in every future version; record it. |
| **"Low hanging fruit"** | Safe only. | No risky or structural changes. |
| **"align"** | Rendered pixels from the screen edge. | See [DOCTRINE.md](DOCTRINE.md) § True edge alignment. Not equal padding values. |

The `Why` rule is the important one. When he writes *"Why is the thead click
area smaller than the rows below?"* he is telling you to fix the header hit
geometry. Answering with the current token values and stopping there is a
non-answer.

## 4. Short requests are surgical

When he names one thing, change that thing.

- Preserve unrelated styling, behaviour, state and data flow.
- Do not refactor for cleanliness alone.
- Do not touch JS/state for a visual request unless the result truly requires
  it.
- Do not reopen a settled decision because you happened to be nearby.

Broaden scope only when the requested result cannot be implemented correctly
at the named ownership level — and say that you are doing it.

## 5. Refactoring is not permission to redesign

When he *does* ask for a refactor, wider cleanup is allowed. Behaviour is
still locked.

Order: inventory the duplicated and late overrides → decide which semantic
owner should win → consolidate tokens and primitives → move geometry to the
owning parent → remove the superseded rules **only after** the owning rule is
verified → preserve semantics and state unless a real defect requires change
→ validate desktop and mobile, sticky layers, disclosures, undo, ordering and
persistence.

Cleaner declarations are not a successful refactor if the rendered result
moved.

## 6. Priority when something has to give

1. a working application
2. correct product and state behaviour
3. locked interaction rules
4. structural hierarchy and layout
5. visual polish

Not every comment carries equal weight. A local cosmetic improvement must
never regress a locked workflow or a product rule.

## 7. He designs by reaction — and by writing comments

His chosen channel is the in-app review console: *"the best action I can take
is write you a comment."* `review/REVIEW-NOTES.md` is the real backlog. See
[`CLAUDE.md`](../CLAUDE.md) for the protocol.

What that means in practice:

- Expect **many short corrections in fast bursts**, sometimes reversing an
  earlier one. Follow the latest. Do not re-litigate the earlier one, and do
  not point out that it changed.
- **Take "this is boring / weird / this looks wrong" at face value.** Change
  the thing. Do not defend it.
- **A comment is usually a direction, not a local edit.** He said it himself:
  *"instead of treating them as precise edits on that layout, treat them as
  holistic comments … ask, can this request be project wide?"* One note on
  one screen is often the same instruction as three notes on three others.
  Find the rule, fix the rule, then fix the cousins.
- **Praise is data too.** "Very reassuring", "good font size placement" mean
  *do not touch this*. Record and leave alone.

## 8. Repeated corrections become doctrine

This is visible in his own documents. Between v141 and v143 he had to explain
alignment more than once, and the answer was not a bug fix — the principle was
promoted into **all seven** context files at once.

So: if he corrects the same class of thing twice, the fix is not another
patch. Write the rule down where it cannot be missed next time, and say that
you did.

The mirror of this is just as important: **record what was rejected.** His
packs carry lines like *"the dark-glass header redesign experiment was
rejected; do not revive without an explicit new request."* Negative space is
documented so nobody re-proposes it in six weeks. Do the same here — see
[PRODUCT-INVARIANTS.md](PRODUCT-INVARIANTS.md) § Rejected.

## 9. Never mark visual work complete from syntax alone

Typecheck passing is not evidence. These need eyes on the running app:

- exact spacing,
- colour balance,
- hover and focus feel,
- motion quality,
- anything that claims to be aligned.

Verify it yourself in the browser and show the proof. Do not ask him to go and
look — he asked you to build it so he would not have to.

Keep a way to prove the change actually landed. In his own patch scripts he
bumps a visible `BUILD_LABEL` for exactly this reason, and every patch ends
with a typecheck.

## 10. Answer style

Action before explanation. For an implementation request the shape is:

> Fixed. The header gear starts at `md` now — it was `lg`, and the bottom bar
> that carries Settings is `md:hidden`, so 768–1023px had no way in at all.

Not three paragraphs of architecture. Save the depth for when he asks for
reasoning, when a decision genuinely needs discussion, or when the work really
was multi-pass — and even then, lead with what changed and put the reasoning
under it.

When you have made a judgement call on an ambiguous request, **state the
reading you took** in one sentence so he can overrule it cheaply.

## 11. Keep these documents current

He maintains versioned context packs as a first-class artifact and expects the
same here. When a decision becomes durable, it goes in the docs in the same
pass as the code — not in a follow-up that never happens.

| Document | Owns |
|---|---|
| [`CLAUDE.md`](../CLAUDE.md) | orientation, review protocol, audience constraints |
| [`WORKING-WITH-SERGEY.md`](WORKING-WITH-SERGEY.md) | this — how to read a request and answer it |
| [`DOCTRINE.md`](DOCTRINE.md) | engineering and design rules that outlive any one layout |
| [`PRODUCT-INVARIANTS.md`](PRODUCT-INVARIANTS.md) | locked behaviour, open domain risks, rejected directions |
| `review/REVIEW-NOTES.md` | the live conversation and the work queue |

If the implementation and a document disagree, one of them is wrong. Fix the
code or deliberately update the document. Do not leave a contradictory rule
standing.
