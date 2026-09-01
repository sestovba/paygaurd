import { useTracker } from './state';

export function ToastStack() {
  const { toasts, dismissToast, undo, canUndo } = useTracker();
  if (!toasts.length) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div className="toast" key={toast.id}>
          <span className="toast__text">{toast.message}</span>
          {toast.undo && canUndo ? (
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
