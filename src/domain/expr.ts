// Basic arithmetic in amount fields: 40*15, 1200+80, (10+2)/2.
// Letters and other punctuation are rejected so this cannot run general JS.

export function evalAmount(raw: string): number | undefined {
  const src = raw
    .trim()
    .replace(/,/g, '')
    .replace(/\$/g, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-');
  if (!src) return undefined;
  if (!/^[\d+\-*/().\s]+$/.test(src)) return undefined;
  let depth = 0;
  for (const ch of src) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (depth < 0) return undefined;
  }
  if (depth !== 0) return undefined;
  if (/[+\-*/(]\s*$/.test(src)) return undefined;
  try {
    const n = Function('"use strict"; return (' + src + ')')();
    return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}
