import clsx, { type ClassValue } from 'clsx';

/**
 * Join class names, dropping falsy ones.
 *
 * `clsx` has been a dependency since the project was scaffolded and was
 * imported exactly nowhere, which is a fair summary of how the component
 * layer was doing: the tools were installed and the layer was never built.
 *
 * No `tailwind-merge` here on purpose. That library exists to resolve two
 * conflicting Tailwind utilities in one string — `px-4` losing to `px-2` — and
 * the controls in this app carry their sizes in CSS classes driven by tokens,
 * so there is nothing to de-conflict. Adding it would buy a bundle and a
 * behaviour to reason about in exchange for a problem we do not have.
 */
export function cn(...parts: ClassValue[]): string {
  return clsx(parts);
}
