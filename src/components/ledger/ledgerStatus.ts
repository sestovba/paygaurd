/*
 * How this layout grades a month, in one place.
 *
 * These four were private to LedgerAnalysis, which was the only surface that
 * graded anything. The entry table now shows the same verdict beside the
 * figure being typed — and a ledger that says "under your limit" in its
 * balance column and something else in its month card below is worse than
 * one that says nothing. One rule, two call sites.
 */

import { nearLimit } from '../../domain/earnings';
import { money0 } from './ledgerFormat';
import type { BenefitPhase } from '../../domain/trialWork';
import type { MonthStatus } from '../../domain/types';

export type StatusKind = 'none' | 'review' | 'safe' | 'warn' | 'twp' | 'over';

export function statusKind(status: MonthStatus, phase: BenefitPhase): StatusKind {
  if (phase === 'unknown' || phase === 'verifyComplete') {
    return status.countable > 0 || status.isServiceMonth ? 'review' : 'none';
  }
  if (phase === 'sga') {
    if (status.countable <= 0) return 'none';
    if (status.overSga) return 'over';
    if (nearLimit(status, phase)) return 'warn';
    return 'safe';
  }
  if (status.isServiceMonth) return 'twp';
  if (status.countable <= 0) return 'none';
  if (nearLimit(status, phase)) return 'warn';
  return 'safe';
}

/* One limit at a time, and named without its abbreviation: the reader is
   only ever under one regime and does not need the other one's initials. */
export function remainingLabel(status: MonthStatus, phase: BenefitPhase): string {
  if (status.countable <= 0 && !status.isServiceMonth) return '';
  if (phase === 'unknown' || phase === 'verifyComplete') return 'Limit not known yet';
  if (phase === 'sga') {
    return status.overSga ? 'Over your limit'
      : status.roomToSga != null ? `${money0(status.roomToSga)} left before your limit` : '';
  }
  if (status.isServiceMonth) return 'Trial month';
  return status.roomToTrialWork != null ? `${money0(status.roomToTrialWork)} left before your limit` : '';
}

/* The same verdict with no room for a sentence — a balance column beside a
   figure being typed. The month card keeps the full line; this is what fits
   in the width a running balance has. */
export function remainingShort(status: MonthStatus, phase: BenefitPhase): string {
  if (status.countable <= 0 && !status.isServiceMonth) return '';
  if (phase === 'unknown' || phase === 'verifyComplete') return 'Limit not known';
  if (phase === 'sga') {
    return status.overSga ? `${money0(status.countable - (status.roomToSga ?? 0))} over`
      : status.roomToSga != null ? `${money0(status.roomToSga)} left` : '';
  }
  if (status.isServiceMonth) return 'Trial month';
  return status.roomToTrialWork != null ? `${money0(status.roomToTrialWork)} left` : '';
}

/* Legend stays short ("Under $X", "Near") because the amount sits next to
   the swatch. Badges in the table have to finish the sentence on their own —
   "Under" / "Near" alone are comparatives with nothing to compare to. */
export const KIND_LABEL: Record<StatusKind, string> = {
  none: 'No income',
  review: 'Limit not known yet',
  safe: 'Under your limit',
  warn: 'Near your limit',
  twp: 'Trial month',
  over: 'Over your limit'
};

export function statusColor(kind: StatusKind): string {
  return kind === 'none' ? 'var(--lg-border)'
    : kind === 'review' ? 'var(--lg-muted)'
      : `var(--lg-${kind})`;
}
