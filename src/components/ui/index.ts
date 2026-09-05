/*
 * The shared control layer.
 *
 * Import from `components/ui` and nowhere else. `legacy.tsx` is the old
 * `ui.tsx` under a name that says what it is; its exports are re-exported
 * here so the twelve existing call sites did not have to move, and each one
 * is a candidate to become a real primitive.
 *
 * The rule this layer exists to enforce: a control is not spelled twice. If
 * a layout needs a button that is not here, the answer is a variant on
 * Button, not a class in that layout's stylesheet. `npm run theme:check`
 * fails a build that reaches for the second option.
 */
export { Button, IconButton, ButtonRow } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize, IconButtonProps } from './Button';
export { Field, Input } from './Field';
export { PaydayInput } from './PaydayInput';
export type { FieldProps, InputProps } from './Field';
export { cn } from './cn';

export { BrandMark, Switch, Chip, Segmented, OptionList, SwatchPicker, AddJobButton } from './legacy';
