import { useRef, useState } from 'react';
import type { ReactNode, UIEvent } from 'react';
import { ChevronLeftIcon, CloseIcon } from './Icons';
import { useSwipeToDismiss } from './useSwipeToDismiss';

import { ButtonBase } from '../../design-system';
const EXIT_MS = 200;

export function SheetSurface({
  label,
  eyebrow,
  title,
  onClose,
  onBack,
  children
}: {
  label: string;
  eyebrow: string;
  title: string;
  onClose: () => void;
  onBack?: () => void;
  children: ReactNode;
}) {
  const [condensed, setCondensed] = useState(false);
  // The parent decides whether this is mounted at all, so unlike
  // AnchoredPopover there's no `open` boolean to watch — closing has to
  // hold this instance up locally, in a bubble-away state, before actually
  // telling the parent to unmount it.
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, EXIT_MS);
  };

  // The body still needs its own vertical drag for scrolling long content,
  // so this only ever attaches to the head/grip, not the whole sheet.
  const swipe = useSwipeToDismiss(sheetRef, requestClose);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    setCondensed(event.currentTarget.scrollTop > 12);
  };

  return (
    <div
      className={'sheet-backdrop' + (closing ? ' sheet-backdrop--closing' : '')}
      onClick={requestClose}
    >
      <div
        ref={sheetRef}
        className={'sheet' + (condensed ? ' sheet--condensed' : '') + (closing ? ' sheet--closing' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="sheet__head"
          onTouchStart={swipe.onTouchStart}
          onTouchMove={swipe.onTouchMove}
          onTouchEnd={swipe.onTouchEnd}
        >
          <span className="sheet__grip" aria-hidden="true" />

          {onBack ? (
            <ButtonBase className="sheet__back" type="button" aria-label="Back" onClick={onBack}>
              <ChevronLeftIcon size={19} />
            </ButtonBase>
          ) : null}

          <div className="sheet__heading">
            <span className="sheet__eyebrow">{eyebrow}</span>
            <div className="sheet__title">{title}</div>
          </div>

          <ButtonBase className="sheet__close" type="button" aria-label="Close" onClick={requestClose}>
            <CloseIcon size={18} />
          </ButtonBase>
        </div>

        <div className="sheet__body" onScroll={onScroll}>
          {children}
        </div>
      </div>
    </div>
  );
}
