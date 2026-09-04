import { money } from '../domain/format';
import type { Capacity } from '../domain/capacity';

/**
 * Where this month sits, on a line with both of its lines drawn on it.
 *
 * The reference design has a progress bar here: $0 on the left, the limit on
 * the right, and a fill that grows as you earn. That is the shape this
 * product cannot use. A bar that fills toward a number you must not reach is
 * a completion metaphor pointed at the wrong target — it looks most
 * rewarding at the moment it should look most careful, and it invites the
 * reader to close the gap. DESIGN-SYSTEM.md § 1.5 and § 1.6.
 *
 * So this is a ruler, not a progress bar, and the difference is in what is
 * labelled. A progress bar labels the end. A ruler labels the marks, and the
 * marks here are the two facts nothing else on the screen can show at once:
 * the figure we aim at, and the limit SSA applies. The band between them is
 * drawn as a place — the careful stretch, where nothing has gone wrong — and
 * that band is the whole reason this drawing earns its space, because in
 * words it takes a paragraph.
 *
 * Every state stays meaningful with no colour at all: the marks are labelled
 * in words underneath, so losing the hue costs the tone and none of the
 * information.
 */
export function LimitRuler({ capacity }: { capacity: Capacity }) {
  /* Headroom past the limit so the limit mark is never flush against the end
     — a mark on the edge of a track reads as the end of the track. */
  const max = Math.max(capacity.threshold * 1.15, capacity.safeCounted * 1.05);
  const pct = (value: number) => Math.min(100, Math.max(0, (value / max) * 100));

  const safeAt = pct(capacity.safeTarget);
  const limitAt = pct(capacity.threshold);
  const at = pct(capacity.safeCounted);

  /* bg-good / bg-destructive, not bg-safe / bg-over. index.css names the
     palette's --t-safe as --good and --t-over as --destructive, so the first
     spelling produced no rule at all and the fill rendered invisible — the
     ruler shipped as two marks floating on nothing. */
  const fill = capacity.over > 0 ? 'bg-destructive' : capacity.stage === 'careful' ? 'bg-warn' : 'bg-good';

  return (
    <div className="mt-5">
      <div className="relative h-3 overflow-hidden rounded-sm bg-surface-2">
        {/* The careful band: past what we aim at, still inside the rules. */}
        <div
          className="absolute inset-y-0 bg-warn-soft"
          style={{ left: `${safeAt}%`, width: `${Math.max(0, limitAt - safeAt)}%` }}
        />
        <div className={'absolute inset-y-0 left-0 rounded-sm ' + fill} style={{ width: `${at}%` }} />
        <div className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${safeAt}%` }} />
        <div className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${limitAt}%` }} />
      </div>

      {/* Named in place, not in a key. A legend is a second thing to read. */}
      <div className="relative mt-1.5 h-8 text-xs font-semibold text-muted-foreground">
        <span className="absolute left-0 whitespace-nowrap">{money(capacity.safeCounted)} counted</span>
        <span className="absolute whitespace-nowrap text-center" style={{ left: `${safeAt}%`, transform: 'translateX(-50%)' }}>
          {money(capacity.safeTarget)}
          <br />
          we aim for
        </span>
        <span className="absolute whitespace-nowrap text-right" style={{ right: `${Math.max(0, 100 - limitAt)}%`, transform: 'translateX(50%)' }}>
          {money(capacity.threshold)}
          <br />
          limit
        </span>
      </div>
    </div>
  );
}
