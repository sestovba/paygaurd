import { CircleDashed, CircleDot, CircleCheckBig } from 'lucide-react';
import type { Precision, PrecisionGap, PrecisionReading } from '../domain/precision';
import { PRECISION_NAME, precisionSentence } from '../domain/precision';

const MARK: Record<Precision, typeof CircleDashed> = {
  estimated: CircleDashed,
  scheduled: CircleDot,
  exact: CircleCheckBig
};

/**
 * How much the figure above this line can be trusted, and the one thing that
 * would improve it.
 *
 * A line under the number rather than a panel of its own: precision is a
 * property of the answer, not a room in the app. A "data quality" card would
 * be one more section competing with the month — and the whole point is to
 * qualify a specific claim at the moment someone is reading it.
 *
 * It names one gap, not all of them. A list of everything missing is a chore;
 * one sentence with a button on it is a trade you can take or leave.
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
  const Mark = MARK[reading.level];
  const gap = reading.gaps[0];
  const fixable = Boolean(gap && onFix);

  const body = (
    <>
      <Mark className="size-3.5 shrink-0" />
      <span className="precision-level">{PRECISION_NAME[reading.level]}</span>
      <span className="precision-why">{precisionSentence(reading)}</span>
    </>
  );

  if (!fixable) {
    return (
      <p className="precision-line" data-level={reading.level}>{body}</p>
    );
  }

  return (
    <button
      type="button"
      className="precision-line"
      data-level={reading.level}
      data-fix
      onClick={() => onFix?.(gap!)}
      title={`Open ${gap!.streamName} and add ${gap!.missing}`}
    >
      {body}
    </button>
  );
}
