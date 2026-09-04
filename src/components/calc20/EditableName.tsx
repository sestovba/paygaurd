// Click the name, type, done. A rename is the most common edit there is and
// should not require opening a settings sheet.

import { useEffect, useRef, useState } from 'react';

import { ButtonBase } from '../../design-system';
export function EditableName({
  value,
  onCommit,
  className,
  ariaLabel
}: {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // An outside rename (import, undo) should win over a stale draft.
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== value) onCommit(next);
    else setDraft(value);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={'name-input ' + (className ?? '')}
        type="text"
        value={draft}
        aria-label={ariaLabel ?? 'Name'}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
      />
    );
  }

  return (
    <ButtonBase
      className={'name-button ' + (className ?? '')}
      type="button"
      title="Click to rename"
      onClick={() => setEditing(true)}
    >
      {value}
    </ButtonBase>
  );
}
