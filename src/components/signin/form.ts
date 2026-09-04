/**
 * The sign-in screen, minus its looks.
 *
 * There are two sign-in screens — PayGuard's and Calc20's — and they are two
 * because they wear different skins, not because they behave differently.
 * Everything that is not markup lives here: the words, the order of the
 * provider buttons, what counts as a filled-in form, and what to say when it
 * is not. A change to any of that reaches both screens, which is the rule the
 * rest of this codebase follows for shared behaviour.
 */

import { useCallback, useState, type FormEvent } from 'react';
import type { AuthState } from '../../auth/useAuth';

export type Provider = 'apple' | 'google';

/**
 * Every user-visible string on the screen, in one place.
 *
 * Three of them are load-bearing and easy to get wrong later:
 *
 * `submit` says "Continue" and not "Sign in", because the form is both. There
 * is no sign-in / create choice to make: the server already knows whether the
 * address has an account, so asking the reader to remember is asking them to
 * answer a question on the app's behalf, and being wrong stopped them.
 *
 * `lede` and `localNote` both stop short of promising that the record follows
 * you between devices. It does not. Cloud sync is gated to an allowlist of
 * one address in state/cloudSync.ts, so for everyone else signing in names
 * the record and nothing more. Saying otherwise would be a promise the app
 * breaks silently, on the screen where trust is cheapest to lose.
 */
export const SIGN_IN_COPY = {
  lede: 'Keep track of what you are paid and what it means for your monthly limit.',
  sublede: 'Your record is kept on this device. Signing in is how the app knows who you are.',
  apple: 'Continue with Apple',
  google: 'Continue with Google',
  or: 'or',
  emailLabel: 'Email address',
  passwordLabel: 'Password',
  passwordHint: 'At least 6 characters.',
  show: 'Show',
  hide: 'Hide',
  submit: 'Continue',
  submitBusy: 'One moment…',
  /* Said under the button rather than as a second tab, because it is the one
   * thing the reader cannot work out by looking: that this form does both. */
  submitNote: 'If you have not used this app before, this makes your account.',
  forgot: 'Forgot your password?',
  forgotBusy: 'Sending…',
  localTitle: 'Use it without an account',
  localNote: 'Your record stays on this device either way. You can sign in later.',
  needEmail: 'Type your email address first.',
  needPassword: 'Type your password.',
  shortPassword: 'Choose a longer password — at least 6 characters.',
  resetNeedsEmail: 'Type your email address above first, then press this again.'
} as const;

/**
 * Which provider button goes first.
 *
 * The reference design leads with Apple. Most of this app's users are on a
 * cheap Android handset, where an Apple ID is a button that does nothing for
 * them — so the platform decides, and whichever is first gets the solid
 * treatment. Reading the platform is a guess, and a wrong guess costs one
 * glance at the second button rather than a dead end.
 */
export function providerOrder(): Provider[] {
  if (typeof navigator === 'undefined') return ['google', 'apple'];
  const nav = navigator as Navigator & { platform?: string };
  const hay = `${nav.platform ?? ''} ${nav.userAgent ?? ''}`;
  return /iPhone|iPad|iPod|Mac/i.test(hay) ? ['apple', 'google'] : ['google', 'apple'];
}

export interface SignInFormState {
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  passwordVisible: boolean;
  togglePassword: () => void;
  /** The one thing the screen has to say right now, and how it should read. */
  message: { text: string; tone: 'error' | 'notice' } | null;
  submit: (event: FormEvent) => void;
  forgot: () => void;
  /** The email form is waiting. Provider buttons have their own. */
  busy: boolean;
  resetting: boolean;
  submitLabel: string;
}

export function useSignInForm(auth: AuthState): SignInFormState {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  /* Caught before the network: an empty field is not worth a round trip, and
   * on a slow connection the reply to one arrives long after the person has
   * given up on the screen. */
  const [localError, setLocalError] = useState('');

  const submit = useCallback((event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();

    if (!address) { setLocalError(SIGN_IN_COPY.needEmail); return; }
    if (!password) { setLocalError(SIGN_IN_COPY.needPassword); return; }
    /* Six is Firebase's floor, so a shorter one cannot be an existing
     * password either — the check is safe on both halves of this form, and
     * saves a round trip that could only ever come back as a refusal. */
    if (password.length < 6) { setLocalError(SIGN_IN_COPY.shortPassword); return; }

    setLocalError('');
    void auth.continueWithEmail(address, password);
  }, [auth, email, password]);

  const forgot = useCallback(() => {
    const address = email.trim();
    if (!address) { setLocalError(SIGN_IN_COPY.resetNeedsEmail); return; }
    setLocalError('');
    void auth.resetPassword(address);
  }, [auth, email]);

  const busy = auth.pending === 'email';
  const resetting = auth.pending === 'reset';

  /* One message region, not three. The reader has one problem at a time, and
   * a form that answers in two places at once is a form nobody reads twice. */
  const message = localError
    ? { text: localError, tone: 'error' as const }
    : auth.error
      ? { text: auth.error, tone: 'error' as const }
      : auth.notice
        ? { text: auth.notice, tone: 'notice' as const }
        : null;

  return {
    email,
    setEmail,
    password,
    setPassword,
    passwordVisible,
    togglePassword: () => setPasswordVisible((on) => !on),
    message,
    submit,
    forgot,
    busy,
    resetting,
    submitLabel: busy ? SIGN_IN_COPY.submitBusy : SIGN_IN_COPY.submit
  };
}
