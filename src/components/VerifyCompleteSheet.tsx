import { useTracker } from '../state/TrackerProvider';
import { formatMonth, todayMonth } from '../domain/months';
import { trialWorkStatus } from '../domain/trialWork';
import { InfoNote } from './InfoNote';
import { Sheet } from './Sheet';

import { ButtonBase } from '../design-system';
export function VerifyCompleteSheet({
  onClose, variant = 'sheet', backLabel
}: {
  onClose: () => void;
  variant?: 'sheet' | 'inline';
  backLabel?: string;
}) {
  const { data, setTwpAssessment } = useTracker();
  const twp = trialWorkStatus(data, todayMonth());

  function confirmComplete() {
    setTwpAssessment({
      state: 'complete',
      basis: 'personal-records',
      checkedOn: new Date().toISOString().slice(0, 10),
      completedOn: twp.completedOn ?? undefined
    });
    onClose();
  }

  return (
    <Sheet
      title="Review status"
      eyebrow="Assessment"
      onClose={onClose}
      variant={variant === 'inline' ? 'inline' : 'modal'}
      backLabel={variant === 'inline' ? backLabel : undefined}
      footer={
        <>
          <ButtonBase
            type="button"
            onClick={onClose}
            className="text-base font-medium text-muted-foreground hover:text-foreground"
          >
            Not yet
          </ButtonBase>
          <ButtonBase type="button" onClick={confirmComplete} className="btn-primary">
            Verify
          </ButtonBase>
        </>
      }
    >
      <InfoNote>
        Based on entered earnings, these 9 months crossed the Trial Work
        line within a rolling 60-month window:
      </InfoNote>
      <p className="rounded-lg border border-border bg-surface-2 p-4 text-base leading-relaxed">
        {twp.inWindow.map(formatMonth).join(', ')}
      </p>
      <p className="type-muted">
        If something looks off, close this and adjust that month. Otherwise confirm below.
      </p>
      <p className="text-base font-medium">I agree this matches my records to the best of my knowledge.</p>
    </Sheet>
  );
}
