import type { Precision, PrecisionGap, PrecisionReading } from '../domain/precision';
import { precisionSentence } from '../domain/precision';
import { copyFor } from '../domain/copy';
import { useTracker } from '../state/TrackerProvider';
import type { Vocabulary } from '../domain/copy';

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
  reading, onFix, variant = 'line'
}: {
  reading: PrecisionReading;
  /** `line` is the compact form that sits under a figure. `gauge` is the same
   *  reading drawn large, for the one place on a screen with room to ask for
   *  something — see PrecisionGauge below. */
  variant?: 'line' | 'gauge';
  /** Opens the source that is holding the reading back. The gap says which
   *  field is missing, so a layout can send you to the quick payday sheet
   *  rather than the whole editor when that is all it needs. */
  onFix?: (gap: PrecisionGap) => void;
}) {
  const { ui } = useTracker();
  const words = copyFor(ui.layout);
  const gap = reading.gaps[0];
  const fixable = Boolean(gap && onFix);
  const filled = LEVELS.indexOf(reading.level) + 1;

  if (variant === 'gauge') return <PrecisionGauge reading={reading} onFix={onFix} />;

  const body = (
    <>
      {/* The gauge. Three pips, filled to the grade — the whole reading in
          one glyph, before a word of it is read. */}
      <span className="precision-pips" aria-hidden="true">
        {LEVELS.map((level, i) => (
          <span key={level} className="precision-pip" data-on={i < filled || undefined} />
        ))}
      </span>
      <span className="precision-level">{gradeName(reading.level, words)}</span>
      {gap ? (
        <span className="precision-why">
          <span className="precision-sep" aria-hidden="true">·</span>
          {gap.streamName}
          {' · '}
          {askFor(gap, words)}
        </span>
      ) : null}
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

/** The ask, as a thing to do rather than a thing that is wrong — in the
 *  words of the layout it is being shown on. */
function askFor(gap: PrecisionGap, words: Vocabulary): string {
  if (gap.kind === 'schedule') return words.askPayday;
  if (gap.kind === 'checks') return words.askPaystub;
  return words.askHours;
}

/** The grade, in the layout's own words. */
function gradeName(level: Precision, words: Vocabulary): string {
  if (level === 'estimated') return words.precisionGuessed;
  if (level === 'scheduled') return words.precisionPredicted;
  return words.precisionExact;
}

/**
 * The same reading, drawn as a gauge.
 *
 * Review note el-1nzt64v: "I skip over this because I mentally dont want to
 * look at it and i don't know what it is" — with a screenshot of a real
 * confidence dial attached. Both halves of that are fair. The compact line is
 * a grey annotation in the corner of somebody's eye, and "Estimated" names a
 * rung on a scale nobody has been shown.
 *
 * So the scale is drawn at the size of the thing it is judging, and it is
 * named the way the attachment names it: Confidence. The number is a real
 * fraction — how many of the facts this month's figure could rest on we
 * actually have — which is why it can sit beside "2 details could improve
 * this estimate" without the two ever contradicting each other. It moves in
 * steps, and with a single job there are genuinely only three answers; a
 * smoother number would be a nicer picture of a worse promise.
 *
 * One component, one reading, two variants, per el-1aml79g and el-14oa3i9:
 * a layout dresses it from chrome.css rather than forking it.
 */
function PrecisionGauge({ reading, onFix }: {
  reading: PrecisionReading;
  onFix?: (gap: PrecisionGap) => void;
}) {
  const { ui } = useTracker();
  const words = copyFor(ui.layout);
  const gap = reading.gaps[0];
  const pct = Math.max(0, Math.min(100, reading.confidence));

  /* A half circle, drawn left to right. The track is the whole arc and the
     fill is a dash of it, so the sweep is one number rather than trigonometry
     at every render. */
  const R = 60;
  const LENGTH = Math.PI * R;
  const arc = `M 10 70 A ${R} ${R} 0 0 1 130 70`;

  return (
    <div className="precision-gauge" data-level={reading.level}>
      <div className="precision-gauge-dial">
        <svg viewBox="0 0 140 78" role="img" aria-label={`Confidence ${pct} percent`}>
          <path className="precision-gauge-track" d={arc} />
          {/* Not drawn at all at zero. stroke-linecap: round paints a round cap
              even on a zero-length dash, which put a stray blue dot at the
              start of an empty gauge — a mark that reads as a value. */}
          {pct > 0 ? (
            <path
              className="precision-gauge-fill"
              d={arc}
              strokeDasharray={`${(LENGTH * pct) / 100} ${LENGTH}`}
            />
          ) : null}
        </svg>
        <div className="precision-gauge-read">
          <span className="precision-gauge-pct">{pct}<small>%</small></span>
          <span className="precision-gauge-word">Confidence</span>
        </div>
        <span className="precision-gauge-end" data-end="lo" aria-hidden="true">0%</span>
        <span className="precision-gauge-end" data-end="hi" aria-hidden="true">100%</span>
      </div>

      {reading.missing ? (
        <>
          {/* "2 details could improve this estimate" named a quantity of
              nothing in particular and offered a comparative — better than
              what? It says what the reader gets: tell us these, and the
              number stops being a guess. */}
          <p className="precision-gauge-note">
            <strong>
              Tell us {reading.missing} more {reading.missing === 1 ? 'thing' : 'things'}
              {' '}and this number becomes exact
            </strong>
            {gap ? <span>{gap.streamName} · {askFor(gap, words)}</span> : null}
          </p>
          {gap && onFix ? (
            <button type="button" className="precision-gauge-go" onClick={() => onFix(gap)}>
              Improve accuracy <span aria-hidden="true">→</span>
            </button>
          ) : null}
        </>
      ) : reading.streams ? (
        <p className="precision-gauge-note">
          <strong>Every amount here came off a real paystub.</strong>
        </p>
      ) : null}
    </div>
  );
}
