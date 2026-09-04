/**
 * Lightweight source list + name prompt for Pocket.
 *
 * Pocket cannot open Settings to add a stream, and it must not drag in
 * PayGuardJobEditor. These two surfaces are only: name a source, list them,
 * delete one. Naming is enough to start logging.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { money } from '../../domain/format';
import { streamYearTotal } from '../../domain/earnings';
import type { Stream } from '../../domain/types';

type AddReturn = 'manage' | 'logging' | 'home';

export type SourcesView =
  | { kind: 'manage' }
  | { kind: 'add'; returnTo: AddReturn };

export function PocketSourcesModals({
  view,
  streams,
  year,
  onClose,
  onOpenAdd,
  onBackToManage,
  onAdd,
  onRemove
}: {
  view: SourcesView | null;
  streams: Stream[];
  year: number;
  onClose: () => void;
  onOpenAdd: () => void;
  onBackToManage: () => void;
  onAdd: (name: string, returnTo: AddReturn) => void;
  onRemove: (id: string) => void;
}) {
  if (!view) return null;

  if (view.kind === 'add') {
    return (
      <AddIncomeSourceModal
        onCancel={() => {
          if (view.returnTo === 'manage') onBackToManage();
          else onClose();
        }}
        onAdd={(name) => onAdd(name, view.returnTo)}
      />
    );
  }

  return (
    <ManageSourcesModal
      streams={streams}
      year={year}
      onDone={onClose}
      onAdd={onOpenAdd}
      onRemove={onRemove}
    />
  );
}

function ManageSourcesModal({
  streams,
  year,
  onDone,
  onAdd,
  onRemove
}: {
  streams: Stream[];
  year: number;
  onDone: () => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const titleId = useId();
  const count = streams.length;
  const subtitle = count === 1 ? '1 income source' : `${count} income sources`;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDone();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDone]);

  return (
    <div
      className="pk-modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onDone}
    >
      <div className="pk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pk-modal-accent" aria-hidden="true" />
        <div className="pk-modal-head">
          <h2 id={titleId} className="pk-modal-title">Manage sources</h2>
          <p className="pk-modal-sub">{subtitle}</p>
        </div>

        <div className="pk-modal-body">
          {streams.length === 0 ? (
            <p className="pk-modal-empty">
              No jobs yet. Add one so you can log pay.
            </p>
          ) : (
            <ul className="pk-source-list">
              {streams.map((stream) => {
                const total = streamYearTotal(stream, year);
                const letter = (stream.name.trim().charAt(0) || '?').toUpperCase();
                return (
                  <li key={stream.id} className="pk-source-card">
                    <span className="pk-source-avatar" aria-hidden="true">{letter}</span>
                    <span className="pk-source-meta">
                      <span className="pk-source-name">{stream.name}</span>
                      <span className="pk-source-total">
                        {money(total)} total logged
                      </span>
                    </span>
                    {stream.locked ? null : (
                      <button
                        type="button"
                        className="pk-source-trash"
                        aria-label={`Remove ${stream.name}`}
                        onClick={() => {
                          if (!confirm(`Remove "${stream.name}"?`)) return;
                          onRemove(stream.id);
                        }}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="pk-modal-foot">
          <button type="button" className="pk-modal-btn pk-modal-btn-outline" onClick={onAdd}>
            + Add source
          </button>
          <button type="button" className="pk-modal-btn pk-modal-btn-primary" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function AddIncomeSourceModal({
  onCancel,
  onAdd
}: {
  onCancel: () => void;
  onAdd: (name: string) => void;
}) {
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const canAdd = trimmed.length > 0;

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canAdd) return;
    onAdd(trimmed);
  }

  return (
    <div
      className="pk-modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onCancel}
    >
      <form className="pk-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="pk-modal-accent" aria-hidden="true" />
        <div className="pk-modal-head">
          <h2 id={titleId} className="pk-modal-title">Add income source</h2>
          <p className="pk-modal-sub">Name a job, gig, or any work that pays you.</p>
        </div>

        <div className="pk-modal-body">
          <label className="pk-modal-label" htmlFor={inputId}>Source name</label>
          <input
            ref={inputRef}
            id={inputId}
            name="sourceName"
            type="text"
            autoComplete="organization"
            placeholder="e.g. Part-time job, Freelance, DoorDash"
            className="pk-btn pk-edit-field pk-modal-input"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </div>

        <div className="pk-modal-foot">
          <button type="button" className="pk-modal-btn pk-modal-btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="pk-modal-btn pk-modal-btn-primary"
            disabled={!canAdd}
          >
            Add source
          </button>
        </div>
      </form>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 6h18M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6h12Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
