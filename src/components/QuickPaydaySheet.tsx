import { useState } from 'react';
import { useTracker } from '../state/TrackerProvider';
import { InfoNote } from './InfoNote';
import { Sheet } from './Sheet';

/**
 * The one field a "Set a payday" notification is actually about — not the
 * full job editor. Resolving a specific, narrow problem should open a
 * specific, narrow form, not bury one date field among eight other
 * unrelated settings.
 */
export function QuickPaydaySheet({
  streamId, onClose, onEditFull, variant = 'sheet', backLabel, closeBeforeEdit = true
}: {
  streamId: string;
  onClose: () => void;
  onEditFull: (streamId: string) => void;
  /** 'inline' renders in the main content area instead of a popup. */
  variant?: 'sheet' | 'inline';
  backLabel?: string;
  /** Modal callers close one sheet before opening the next. A retained-pane
   *  workspace can keep this quick fix as the parent of the full editor. */
  closeBeforeEdit?: boolean;
}) {
  const { data, updateStream } = useTracker();
  const stream = data.streams.find((s) => s.id === streamId);
  const [date, setDate] = useState(stream?.anchorDate ?? '');
  if (!stream) return null;

  return (
    <Sheet
      title={`Payday for ${stream.name}`}
      eyebrow="Quick fix"
      onClose={onClose}
      variant={variant === 'inline' ? 'inline' : 'modal'}
      backLabel={variant === 'inline' ? backLabel : undefined}
      footer={
        <>
          <button
            type="button"
            onClick={() => {
              if (closeBeforeEdit) onClose();
              onEditFull(stream.id);
            }}
            className="text-base font-medium text-muted-foreground hover:text-foreground"
          >
            Edit full job details
          </button>
          <button
            type="button"
            disabled={!date}
            onClick={() => { updateStream(stream.id, { anchorDate: date }); onClose(); }}
            className="btn-primary disabled:opacity-40"
          >
            Save
          </button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className="field-label">Payday</span>
        <input
          className="field-input"
          type="date"
          autoFocus
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>

      <InfoNote>
        Any one real pay date — past or upcoming — is enough. It tells us
        every other payday on this job's schedule, forward and backward.
      </InfoNote>
    </Sheet>
  );
}
