import { useTracker } from '../../state/TrackerProvider';
import { MonthSheet } from '../MonthSheet';
import { QuickPaydaySheet } from '../QuickPaydaySheet';
import { SettingsPanel } from '../SettingsPanel';
import { StreamSheet } from '../StreamSheet';
import { TwpWizard } from '../TwpWizard';
import { VerifyCompleteSheet } from '../VerifyCompleteSheet';
import type { MonthKey } from '../../domain/types';

export type PageId = 'overview' | 'income' | 'status';

/**
 * The six things you can open from Overview, and the one component that
 * opens them.
 *
 * All three shells offered exactly these six and each wrote out all six —
 * eighteen call sites for six components, differing only in `variant` and in
 * what happens when one detail opens another. The scroll shell had it worst:
 * it held seven independent booleans, so nothing stopped two being true at
 * once. A request is one value now, and opening a new one always supersedes
 * whatever was open.
 *
 * `onChild` is the part the shells genuinely disagree about, so it is the
 * part they still answer for themselves: a month can open a source, and a
 * quick payday fix can open the full editor. A modal replaces itself, a page
 * replaces itself, and a workspace pushes a pane beside the one you are in.
 */
export type DetailRequest =
  | { kind: 'month'; month: MonthKey }
  | { kind: 'stream'; streamId: string }
  | { kind: 'payday'; streamId: string }
  | { kind: 'quiz' }
  | { kind: 'verify' }
  | { kind: 'settings' };

export function detailLabel(
  request: DetailRequest,
  monthName: (month: MonthKey) => string,
  streamName: (id: string) => string
): string {
  switch (request.kind) {
    case 'month': return monthName(request.month);
    case 'stream': return streamName(request.streamId);
    case 'payday': return 'Set a payday';
    case 'quiz': return 'Where you stand';
    case 'verify': return 'Review status';
    case 'settings': return 'Settings';
  }
}

export function Detail({
  request,
  variant = 'sheet',
  backLabel,
  onClose,
  onChild,
  onOpenStatus,
  /* Modal callers close one sheet before opening the next; a retained-pane
     workspace keeps the quick fix as the parent of the full editor. */
  closeBeforeEdit = true
}: {
  request: DetailRequest;
  variant?: 'sheet' | 'inline';
  backLabel?: string;
  onClose: () => void;
  /** A detail opening another detail. The shell decides where it goes. */
  onChild: (next: DetailRequest) => void;
  onOpenStatus: () => void;
  closeBeforeEdit?: boolean;
}) {
  /* Settings used to be handed theme, layout, a reset and two setters down
     through every shell. It is the same tracker context this reads, so the
     shells no longer carry any of it. */
  const { ui, setUi, resetAll } = useTracker();

  switch (request.kind) {
    case 'stream':
      return (
        <StreamSheet
          streamId={request.streamId}
          onClose={onClose}
          variant={variant}
          backLabel={backLabel}
        />
      );

    case 'month':
      return (
        <MonthSheet
          month={request.month}
          onClose={onClose}
          onOpenStream={(streamId) => onChild({ kind: 'stream', streamId })}
          variant={variant}
          backLabel={backLabel}
        />
      );

    case 'payday':
      return (
        <QuickPaydaySheet
          streamId={request.streamId}
          onClose={onClose}
          onEditFull={(streamId) => onChild({ kind: 'stream', streamId })}
          variant={variant}
          backLabel={backLabel}
          closeBeforeEdit={closeBeforeEdit}
        />
      );

    case 'quiz':
      return <TwpWizard onClose={onClose} variant={variant} backLabel={backLabel} />;

    case 'verify':
      return <VerifyCompleteSheet onClose={onClose} variant={variant} backLabel={backLabel} />;

    case 'settings':
      return (
        <SettingsPanel
          theme={ui.theme}
          onTheme={(theme) => setUi({ theme })}
          onOpenStatus={onOpenStatus}
          onReset={() => { resetAll(); onClose(); }}
          onClose={onClose}
          variant={variant}
          backLabel={backLabel}
          layout={ui.layout}
          onLayoutChange={(layout) => setUi({ layout })}
        />
      );
  }
}
