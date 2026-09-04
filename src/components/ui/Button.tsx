import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/**
 * The button. There is one.
 *
 * Before this, eight layouts had forty-eight button classes between them
 * across twenty-four different heights. The classes it draws are defined once
 * in `src/styles/controls.css` and every value in them comes from a token, so
 * a theme reshapes all of them by answering metrics.css's shape choices.
 *
 * WHY THE VARIANT NAMES ARE THESE
 *
 * Material 3's button types, under names that say what they do rather than
 * how they are drawn — `filled` is the one action on the screen, `tonal` is a
 * secondary action that still wants weight, `outlined` is a peer among
 * several, `ghost` is a control that should not compete with the content.
 * `danger` is not an M3 type and is here because this app's destructive
 * actions delete somebody's income record.
 *
 * `type` defaults to "button". React does not, HTML defaults to "submit", and
 * a button inside the app's sheets that submits a form reloads the page and
 * loses what was typed. That has been a real bug in three layouts.
 */
export type ButtonBaseProps = ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Behavior-only button primitive for layout-owned skins.
 *
 * Use this when a layout deliberately owns every visual property itself.
 * It adds no classes; its value is the safe HTML default, ref forwarding,
 * and one shared semantic primitive instead of hand-written <button>s.
 */
export const ButtonBase = forwardRef<HTMLButtonElement, ButtonBaseProps>(function ButtonBase(
  { type = 'button', ...rest },
  ref
) {
  return <button ref={ref} type={type} {...rest} />;
});

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Fill the width of the parent — the single primary action on a phone. */
  block?: boolean;
  /** Rendered before the label, at the control's icon size. */
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'outlined', size = 'md', block = false, icon, className, children, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'ui-btn',
        `ui-btn-${variant}`,
        size !== 'md' && `ui-btn-${size}`,
        block && 'ui-btn-block',
        className
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

/**
 * A button that is only an icon.
 *
 * `label` is required and is not decoration: an icon-only control with no
 * accessible name is invisible to a screen reader, and six of the classes
 * this replaces had none. It is also why there is no `title` prop — a title
 * attribute is not read reliably and does not survive touch.
 *
 * The default size is the full touch target, not the icon's size. Six of the
 * old icon buttons were 28–34px, under both Android's 48dp guidance and
 * WCAG 2.5.8, in an app used one-handed by people with motor impairments.
 */
export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  children: ReactNode;
  size?: 'sm' | 'md';
  tone?: 'default' | 'danger';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, size = 'md', tone = 'default', className, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        'ui-btn-icon',
        size === 'sm' && 'ui-btn-icon-sm',
        tone === 'danger' && 'ui-btn-icon-danger',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

/** The footer of a sheet. Was `.btn-row`, `.button-row`, `.review-row-buttons`
 *  and four inline flexes, each with its own gap. */
export function ButtonRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('ui-btn-row', className)}>{children}</div>;
}
