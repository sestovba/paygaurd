// Transient confirmation of an edit, and the last chance to take it back.
//
// This existed only in calc20, which meant six of the seven layouts could
// delete an income source or clear a year and say nothing at all. A
// confirmation is a property of the edit, not of the skin it was made in, so
// the state moved into TrackerProvider and this draws it for everyone.

import { useTracker } from '../state/TrackerProvider';

export function ToastStack() {
  const { toasts, dismissToast, undo, undoCount } = useTracker();
  if (!toasts.length) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div className="toast" key={toast.id}>
          <span className="toast__text">{toast.message}</span>
          {/* Undo is offered only while there is genuinely a step to take
              back — a button that says Undo and does nothing is worse than
              no button, because it is the one you reach for in a hurry. */}
          {toast.undo && undoCount > 0 ? (
            <button
              className="toast__action"
              type="button"
              onClick={() => { undo(); dismissToast(toast.id); }}
            >
              Undo
            </button>
          ) : (
            <button
              className="toast__action"
              type="button"
              onClick={() => dismissToast(toast.id)}
            >
              Dismiss
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
