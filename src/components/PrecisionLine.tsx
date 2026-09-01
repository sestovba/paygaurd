import type { Precision, PrecisionGap, PrecisionReading } from '../domain/precision';
import { PRECISION_NAME, precisionSentence } from '../domain/precision';

/** The scale, in order. Three states is a scale, and a scale can be drawn. */
const LEVELS: Precision[] = ['estimated', 'scheduled', 'exact'];

/**
 * How much the figure above this line can be trusted, and the one thing that
 * would improve it.
 *
 * A line under the number rather than a panel of its own: precision is a
 * property of the answer, not a room in the app. A "data quality" card would
 * be one more section competing with the month — and the whole point is to
 * qualify a specific claim at the moment someone is reading it.
 *
 * Review note: "this one is hazy, how can we design it better so that the
 * design communicates the thought visually to the user without writing
 * descriptive text? What is the best visual? Least amount of text."
 *
 * The haze was that it argued its case in a sentence — a name, a job, a
 * missing field and a parenthetical about what that costs — where three
 * states is a *scale*, and a scale is a picture. So the scale is drawn: three
 * pips, filled to the grade this reading is at, which says "two of three" at a
 * glance and needs no legend to be felt. The words left are the grade and the
 * ask, both of them short, and the ask is a verb rather than a diagnosis:
 * "add a paystub", not "is missing your actual paystub amount for this month
 * (this total is estimated, not from a real paystub)". The full sentence is
 * still there for anyone who wants it, on the element's own title.
 */
export function PrecisionLine({
  reading, onFix
}: {
  reading: PrecisionReading;
  /** Opens the source that is holding the reading back. The gap says which
   *  field is missing, so a layout can send you to the quick payday sheet
   *  rather than the whole editor when that is all it needs. */
  onFix?: (gap: PrecisionGap) => void;
}) {
  const gap = reading.gaps[0];
  const fixable = Boolean(gap && onFix);
  const filled = LEVELS.indexOf(reading.level) + 1;

  const body = (
    <>
      {/* The gauge. Three pips, filled to the grade — the whole reading in
          one glyph, before a word of it is read. */}
      <span className="precision-pips" aria-hidden="true">
        {LEVELS.map((level, i) => (
          <span key={level} className="precision-pip" data-on={i < filled || undefined} />
        ))}
      </span>
      <span className="precision-level">{PRECISION_NAME[reading.level]}</span>
      {gap ? <span className="precision-why">{gap.streamName} · {askFor(gap)}</span> : null}
    </>
  );

  if (!fixable) {
    return (
      <p className="precision-line" data-level={reading.level} title={precisionSentence(reading)}>
        {body}
      </p>
    );
  }

  return (
    <button
      type="button"
      className="precision-line"
      data-level={reading.level}
      data-fix
      onClick={() => onFix?.(gap!)}
      title={precisionSentence(reading)}
    >
      {body}
    </button>
  );
}

/** The ask, as a thing to do rather than a thing that is wrong. */
function askFor(gap: PrecisionGap): string {
  if (gap.kind === 'schedule') return 'add a payday';
  if (gap.kind === 'checks') return 'add a paystub';
  return 'add hours worked';
}
