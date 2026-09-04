# The review console's vocabulary

One word, one meaning. A term that means two things is worse than two terms
that mean one thing each, because the second is only verbose and the first is
wrong half the time.

This file is the list. If a label is added or changed, it goes here first —
and if it collides with something below, one of them is wrong.

The report (`review/REVIEW-NOTES.md`) uses these same words in capitals,
because the file is the other half of the conversation and a word that means
one thing in the app and another in the file is worth nothing.

---

## Objects — the things the console has

| Term | Means | Not |
|---|---|---|
| **Note** | One record about one element: what was said, its state, its thread. | The element itself; the Ask button. |
| **Element** | A piece of the page under review. | The note about it. |
| **Thread** | The back-and-forth on one note. Entries are **replies**. | The note. |
| **Notes** | The one list of every note, grouped by whose move it is. | One note; the console. |
| **Console** | The whole review tool. Its sections are **panels**. | Notes. |
| **Panel** | One section of the dock. There are two: Tools and Notes. | A column of the Notes table. |
| **Column** | A column of the Notes table: Do, Item, Where, State. | A panel. |
| **Rail** | The console docked down a side or along the bottom. | The dock on a phone. |
| **Hidden** | An element switched off on the page (`display: none`) while you find out whether you miss it. | Cut; Closed. |
| **Group** | One of the three bands in Notes: Yours, Claude, Closed. | A panel; a state. |
| **Lens** | A filter chip over the one list — Comments, Hidden. | A panel. |
| **Certainty** | How sure a proposal I made is: Sure, Likely, Hunch. | A state; a verdict. |
| **Scope** | What a note is about: **This**, **Layout** or **Everywhere**. | Where it was seen; the layout it was written in. |
| **Reference point** | The heading a scoped note is filed against — a real heading in a real markdown file. | A topic; a tag. |
| **Frame** | The page rendered at a chosen device size, in its own viewport. | The rail; the window. |

**Scope** answers a different question from **Where**, and keeping them apart
is the whole reason it exists. Where a note was *seen* is a layout and a page;
what it is *about* may be the product. A note that says "default should be
rest of the year on all layouts" is filed under Everywhere and was seen on
workrecord, and both facts are kept — collapsing them into one is how the same
instruction came to be re-filed on five separate screens.

The three scopes are named for what they point at, not for how big they are:

| Scope | Points at | Filed against |
|---|---|---|
| **This** | The element under the crosshair. | Its source file and line. |
| **Layout** | One layout, whole. | That layout's `README.md`. |
| **Everywhere** | The product. | The rule it is about, in `CLAUDE.md`, `WORKING-WITH-SERGEY.md`, `DESIGN-SYSTEM.md` or `THE-THREAD.md`. |

A **reference point** is deliberately not a topic the reviewer types. The
rules of this product are already written down and already have names, so a
note filed against one arrives in the same words the answer will be written
in — and, the part that matters, the next session finds it by reading the
rule.

There is no **Archive** and no **Shelf**. Version control is the archive:
nothing that reaches the code is lost by cutting it. In the console, "where
did the note go" is answered by **Closed** and "where did the element go" by
**Hidden** — one answer each, no folders.

Three words one letter apart shared a panel until they were separated:
**Notes** is the panel, **Marked** is a note that asks for nothing (it was
"Noted"), and **Ask** is the button that hands one over as a question (it was
"Note"). A button called Note, inside a panel called Notes, on a row that is
a note, said nothing at all.

## Acts — the things you do

| Term | Means | Not |
|---|---|---|
| **Select** | Designate what the next action applies to — an element on the page, or rows in Notes. Same act, two kinds of object. | Audit. |
| **Audit** | Walk the cuts the AI proposed, answering each. | Select. |
| **Locate** | Take you to the element: switch layout and open the page if that is what it takes, scroll it into view, and flash it. | Select; Comment. |
| **Comment** | Say what should change. Starts a note. Needs no element — with nothing selected it opens against the layout. | Reply. |
| **Reply** | Add to an existing note's thread. | Comment. |
| **Cut** | Take the element out of the product. A decision for the code, queued for a pass — nothing disappears when you press it. | Delete; Hide. |
| **Delete** | Throw away the note and its thread. The element is untouched. | Remove. |
| **Hide** | Switch the element off on screen to see whether you miss it. Reversible, code untouched. Puts the note in **Trying**. | Cut; Delete. |
| **Move** | Reposition the element in the layout. | Changing a note's state. |
| **Approve** | Accept work that came back: the change was made and it is right. The one act that may set **Done**. | Close; Keep. |
| **Close** | Leave the console, or shut an open row. | Done; Approve. |
| **Dismiss** | Take a note off the board. A proposal I made is remembered as dismissed so it is not made again; a note you wrote has nothing to remember, so it goes. Undo brings either back. | Remove; Delete. |
| **Restore** | Put a hidden element back on the page. The answer to a trial you did miss. | Undo. |
| **Undo** | Step back through decisions. Never touches the app's own data. | Delete; Restore. |

## State — where a note has got to

One state per note, in `status`. Both sides write it. Changing it is called
**setting the state**, never "moving" — Move means repositioning an element.

Exactly one is true at a time, and each belongs to exactly one **group**,
which is whose move it is:

| State | Group | Means |
|---|---|---|
| **New** | Yours | Not looked at yet. |
| **Yours** | Yours | Looked at; say what you want done. |
| **Trying** | Yours | Off the page while you see whether you miss it. |
| **Sent** | Claude | Handed over. Waiting on a code pass. |
| **Answered** | Yours | Claude replied — check it and close it. |
| **Done** | Closed | Acted on in the code, and confirmed. |
| **Later** | Closed | Deliberately deferred. Not deleted. |
| **Kept** | Closed | Looked at and kept as it is. |

**Done is never asserted, only earned.** It is the one state that is a claim
about the code rather than about the reviewer, so it is checked on every read:
an item that still owes a change and has no reply saying the change was made
is not Done, whoever wrote the word. The console refuses to set it, and the
file is re-read the same way.

## Certainty — how sure a proposal is

Carried by proposals only. Your own notes are not proposals and have none.

| Level | Means |
|---|---|
| **Sure** | Checkable from the code. Little judgement involved. |
| **Likely** | A real argument, but it depends on how the product is used. The default. |
| **Hunch** | A question more than a claim. Your call entirely. |

## Do — what a note is asking for

The Notes table's first column, and its filter chips. One word for the move that
is still owed.

| Verb | When | Report |
|---|---|---|
| **Cut** | A proposed cut you agreed with. | `CUT` |
| **Rework** | You asked for a change; my move. | `COMMENT` |
| **Ask** | A question with no decision attached; my move. | `COMMENT` |
| **Reply** | I answered; your move. | `COMMENT` |
| **Move** | The element should sit somewhere else. | `MOVE` |
| **Picked** | An A/B choice was made. | `PICKED` |
| **Apply** | An approved suggestion that is not a deletion. | `REMOVE` |
| **Marked** | Pointed at, with nothing asked of it. | — |

## Colour — what a Do is asking for

One hue per verb, and grey for the ones asking for nothing. The colour is
worn by the Do chip and by the row's own spine, so a screenful says what kind
of pass it is going to be before a word of it is read.

| Colour | Do |
|---|---|
| Red | **Remove** |
| Green | **Picked** — an A/B answered is settled, which is the one thing green has ever meant here |
| Blue | **Change**, **Reply**, **Apply** — the console's own colour, for the ones in conversation |
| Violet | **Move** — not a cut at all, a relocation |
| Amber | **Unsure** — what an open question looks like everywhere else in the console |
| Grey | **Archived**, **Hidden**, **Noted** — nothing is owed on these |

Amber and blue are also State's colours (To do, Commented). They do not
collide: State is a pill on the right of the row and Do is a chip on the
left, and a row is only ever wearing one of each.

## Collisions fixed in this pass

- **Keep** was a category for work nobody owes. A proposal turned down is a
  finished conversation, and it sat on the board as a row you read and
  skipped every time. Turning one down is now **Dismiss**, and it takes the
  note off the board rather than filing it under a verb.
- **Unsure** is the answer that was missing. Before it, a proposal you had
  considered and could not call went back into the pile with the ones you had
  not looked at yet.
- **Find it**, in the queue, and **Locate**, on a Notes row, were one act
  under two names. It is **Locate**.
- **Delete** was a bin on every row of a list you are mostly reading, behind
  a confirm dialog — two frictions paying for one act, and it said the main
  thing you might do to a note is destroy it. The row's way out is **Dismiss**.
- **Show**, **Put back** and **Restore** were three words for putting a
  hidden or archived element back — one on the on-page slot, one in the
  Hidden panel, one on an archive chip. It is **Restore**.
- The Hidden panel wore an eye on its header, an eye on every row's name and
  an eye on every row's button: "hidden" three times before you reached the
  label. The header keeps it; the rows say what pressing them does.
- **Second look** (a state) and **Unsure** (a do) are close enough to be worth
  watching. They are not the same: Second look is *filed, come back to it*;
  Unsure is *not filed, cannot call it*. If they start being used
  interchangeably, one of them is wrong.
- **Close** was doing the job **Approve** does now. The button on an answered
  note said Close, which this file had already defined as leaving the console
  or shutting a row — so the one act that files work as Done was wearing the
  word for the act that files nothing. Accepting an answer is **Approve**.
- **Keep** was on the card after Claude had replied, where it read as
  "staying as it is" about an element that had just been changed — a sentence
  with two meanings and no way to pick one. An answered note offers four
  verbs and Keep is not among them: Approve, Cut, Rework, Ask. The set for
  each state is `decisionsFor` in `state.ts`, and it is the only place that
  decides which verbs a note is asked with.

## Where the words live

`DO` in `ReviewProvider.tsx` — one map, read by the chip on the row, the
filter strip above the board, and (through `markdown.ts`) the report. Change
a value there and the word changes in all three.

What that map cannot do is add or remove an entry. `actOf` works each word
out from the note itself: approving a cut *makes* it `remove`, archiving
*makes* it `archived`. There is no field holding the word, so there is
nothing for a delete to delete except the notes.

## Read — what you have looked at

Per note, local to the browser, never in the shared file. **Unread** means it
has changed since you last looked at it. Distinct from **state**: a note can
be read and still be To do, or unread and already Done.

---

## Collisions that were fixed, and why they were collisions

- **Done** was both the button that left the console and the lane a finished
  note sits in. The button is **Close**.
- **Move to** was the bulk control for changing state, while **Move** in the
  Do column meant repositioning an element. The bulk control says **State**.
- **Stash / Stashed** and **Archive** were three words for one place. All of
  it is **Archive**, and one place in it is a **shelf**.
- **Answer** in the Do column and **Reply** on the button were one act. It is
  **Reply**.
- **Cut** read as cut-and-paste beside Move and Archive, and never said
  whether the element or the note was being cut. It is **Remove**, which
  pairs with Keep.
- **Revise** and **Change** were one act; which side owes it is what **Reply**
  already says.
- **Read** was in the Do column, which put a non-action among the actions and
  made every remark look like a chore. Reading is a **read mark**, nothing
  more.
- **The note's name** was doing two acts at once: it opened nothing and
  travelled to the element instead, while an icon beside it opened the note.
  A name opens the thing it names. Travelling to the element is **Locate**,
  and it has a button of its own.

## Deliberately one word for two objects

**Select** applies to elements on the page and to rows in Notes. It is
one definition — *designate what the next action applies to* — so it stays
one word. The same is true of **open** (a row, a panel, the console) and
**close**.
