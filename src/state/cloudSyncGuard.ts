import { useCallback, useState } from 'react';

/**
 * The steps between pressing the sync switch and the thing actually
 * happening — once, for both settings screens.
 *
 * This exists because the two screens disagreed about how dangerous the
 * switch is, and one of them was wrong. `setCloudSyncEnabled(false)` calls
 * `deleteCloudData(uid)`: turning sync off does not unlink this device, it
 * **deletes the account's copy out of Firebase**, and there is no undo and no
 * second copy anywhere unless the person made one. calc20 knew that and
 * spent a whole screen on it — a consent panel going on, and going off a
 * typed DELETE with a backup downloaded the moment you confirm. The shared
 * panel, which is what the other nine layouts show, had it on a plain
 * toggle: one tap, no question asked, data gone.
 *
 * Nine layouts were not going to grow that screen by being asked nicely, so
 * the steps live here and each screen draws them in its own primitives. What
 * is shared is the part that matters and the part nobody should be
 * re-deciding: that turning it on is consented to, that turning it off is
 * typed out in full, and that the backup is downloaded **before** the delete
 * rather than offered after it.
 */

/** Typed in full to turn sync off. A word, not a tap, because the tap is
 *  indistinguishable from the tap that turned it on and this one deletes. */
export const SYNC_OFF_CONFIRM_WORD = 'DELETE';

export type SyncGuardStep = 'idle' | 'consent' | 'confirm-off';

export interface CloudSyncGuard {
  /** Which panel to show under the switch, if any. */
  step: SyncGuardStep;
  confirmText: string;
  setConfirmText: (text: string) => void;
  /** True once the confirmation is typed out exactly. */
  canConfirmOff: boolean;
  /** The switch itself: opens the step the current state calls for, and
   *  closes it again if it is already open. Never changes sync on its own. */
  press: () => void;
  cancel: () => void;
  /** Consented: sync on. */
  turnOn: () => void;
  /** Confirmed: backup first, then the delete. In that order — if the
   *  download fails the data is still in Firebase, which is the survivable
   *  way round. */
  turnOffWithBackup: () => void;
}

export function useCloudSyncGuard({
  enabled,
  setEnabled,
  backup
}: {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  /** Download a copy of everything to this device. */
  backup: () => void;
}): CloudSyncGuard {
  const [step, setStep] = useState<SyncGuardStep>('idle');
  const [confirmText, setConfirmText] = useState('');

  const close = useCallback(() => {
    setStep('idle');
    setConfirmText('');
  }, []);

  const press = useCallback(() => {
    setConfirmText('');
    setStep((current) => (current !== 'idle' ? 'idle' : enabled ? 'confirm-off' : 'consent'));
  }, [enabled]);

  const turnOn = useCallback(() => {
    setEnabled(true);
    close();
  }, [setEnabled, close]);

  const turnOffWithBackup = useCallback(() => {
    backup();
    setEnabled(false);
    close();
  }, [backup, setEnabled, close]);

  return {
    step,
    confirmText,
    setConfirmText,
    canConfirmOff: confirmText === SYNC_OFF_CONFIRM_WORD,
    press,
    cancel: close,
    turnOn,
    turnOffWithBackup
  };
}
