import { useTracker } from './state';

import { ButtonBase } from '../../design-system';
export function ToastStack() {
  const { toasts, dismissToast, undo, canUndo } = useTracker();
  if (!toasts.length) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div className="toast" key={toast.id}>
          <span className="toast__text">{toast.message}</span>
          {toast.undo && canUndo ? (
            <ButtonBase
              className="toast__action"
              type="button"
              onClick={() => { undo(); dismissToast(toast.id); }}
            >
              Undo
            </ButtonBase>
          ) : (
            <ButtonBase
              className="toast__action"
              type="button"
              onClick={() => dismissToast(toast.id)}
            >
              Dismiss
            </ButtonBase>
          )}
        </div>
      ))}
    </div>
  );
}
