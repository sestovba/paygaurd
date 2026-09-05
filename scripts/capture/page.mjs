/**
 * The half of the capture that runs inside the page.
 *
 * These are ordinary functions, serialized with `toString()` and handed to
 * `Runtime.evaluate`. Written as functions rather than template strings so
 * they are syntax-checked, formatted and greppable like the rest of the
 * codebase — the only rule is that each one must be self-contained, because
 * nothing it closes over travels with it.
 */

/** Serialize `fn` and run it in the page with one JSON argument. */
export async function call(page, fn, arg = null) {
  const { result, exceptionDetails } = await page.send('Runtime.evaluate', {
    expression: `(${fn.toString()})(${JSON.stringify(arg)})`,
    returnByValue: true,
    awaitPromise: true
  });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  }
  return result?.value;
}

/* ------------------------------------------------------------------ */
/* Making the whole layout visible                                     */
/* ------------------------------------------------------------------ */
/*
 * `captureBeyondViewport` photographs a tall document. It does nothing for
 * this app, because none of these layouts make a tall document: they are app
 * shells — a root pinned to `100dvh` with the scrolling happening in a box
 * inside it. The document's scrollHeight is one screen, forever.
 *
 * So the page is unfurled before the shot: every real scroll container is
 * allowed to be its own height, and so is every viewport-locked ancestor
 * holding it down. Then the viewport is set to the height that produces, and
 * one screenshot is the whole layout with no stitching and no seam.
 *
 * What it costs, and it is worth saying out loud in the report: a layout with
 * rules keyed on `100dvh` is being measured against a viewport no phone has.
 * That is why the fold-height shot is taken as well and is the one named
 * first — the full-page image is for reading a layout, not for judging what
 * a phone shows first.
 */
export function unfurl() {
  const undo = [];
  const stash = (el, prop, value) => {
    undo.push([el, prop, el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)]);
    el.style.setProperty(prop, value, 'important');
  };

  const scrollers = [];
  for (const el of document.querySelectorAll('*')) {
    const style = getComputedStyle(el);
    const scrolls = style.overflowY === 'auto' || style.overflowY === 'scroll';
    if (scrolls && el.scrollHeight > el.clientHeight + 4) scrollers.push(el);
  }

  /* An element is only opened up when it is actually holding content back —
     a scroll container that scrolls, or an ancestor of one that is pinned to
     the viewport's height. Every other `overflow: hidden` on the page is a
     rounded corner or a clipped decoration, and neutralising those turns a
     screenshot into a picture of a broken page. */
  const touched = new Set();
  const open = (el) => {
    if (touched.has(el) || el === document.documentElement) return;
    touched.add(el);
    stash(el, 'overflow', 'visible');
    stash(el, 'height', 'auto');
    stash(el, 'max-height', 'none');
    stash(el, 'flex', 'none');
  };

  const locked = (el) => {
    const box = el.getBoundingClientRect();
    return box.height >= window.innerHeight - 2 && getComputedStyle(el).overflow !== 'visible';
  };

  for (const scroller of scrollers) {
    open(scroller);
    for (let up = scroller.parentElement; up && up !== document.body; up = up.parentElement) {
      if (locked(up)) open(up);
    }
  }
  if (document.body && locked(document.body)) open(document.body);

  window.__pgUnfurl = undo;
  return {
    opened: touched.size,
    height: Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight ?? 0
    ),
    width: document.documentElement.clientWidth
  };
}

/** Put every one of those properties back exactly as it was — including the
 *  ones that were not set at all, which is what the empty string means. */
export function refurl() {
  for (const [el, prop, value, priority] of window.__pgUnfurl ?? []) {
    if (value) el.style.setProperty(prop, value, priority);
    else el.style.removeProperty(prop);
  }
  delete window.__pgUnfurl;
  return true;
}

/* ------------------------------------------------------------------ */
/* Waiting                                                             */
/* ------------------------------------------------------------------ */

/**
 * Is the page done moving?
 *
 * Not "has it loaded" — this app code-splits one lazy chunk per layout, so
 * `load` fires on a shell with nothing in it. The honest test is that the
 * markup stopped changing and no animation is running, so that is what this
 * asks, twice, a frame or so apart.
 */
export function settle({ quietMs, capMs }) {
  return new Promise((resolve) => {
    const started = Date.now();
    let last = '';
    let still = 0;

    const tick = () => {
      const now = document.body ? `${document.body.innerHTML.length}:${document.body.childElementCount}` : '';
      const running = typeof document.getAnimations === 'function'
        ? document.getAnimations().filter((a) => a.playState === 'running').length
        : 0;

      if (now === last && !running) still += 1;
      else still = 0;
      last = now;

      if (still >= 2 || Date.now() - started > capMs) {
        // Fonts change metrics, and a screenshot taken before they land is a
        // picture of the fallback stack.
        (document.fonts?.ready ?? Promise.resolve()).then(() =>
          requestAnimationFrame(() => resolve(Date.now() - started))
        );
        return;
      }
      setTimeout(tick, quietMs);
    };
    tick();
  });
}

/* ------------------------------------------------------------------ */
/* What can be clicked                                                 */
/* ------------------------------------------------------------------ */

/**
 * Everything on this screen a person could press, with a handle that survives
 * a reload.
 *
 * The handle is an nth-child path rather than an id or a class: ids on this
 * page are mostly review anchors, classes are utility soup, and the path is
 * the one thing that is both unique and reproducible when the same state is
 * rebuilt from a fresh load. That reproducibility is the whole mechanism —
 * every state in a crawl is reached by replaying a path from the front door,
 * never by accumulating clicks in one long session that nobody could repeat.
 */
export function clickables(limit) {
  const SELECTOR = [
    'button', '[role="button"]', 'a[href]', 'summary', 'select',
    'input[type="checkbox"]', 'input[type="radio"]', '[role="tab"]',
    '[role="switch"]', '[role="menuitem"]', '[role="menuitemradio"]', 'label[for]'
  ].join(',');

  const pathOf = (el) => {
    const parts = [];
    for (let node = el; node && node.nodeType === 1 && node !== document.documentElement; node = node.parentElement) {
      const index = [...node.parentElement.children].indexOf(node) + 1;
      parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${index})`);
    }
    return `html>${parts.join('>')}`;
  };

  /* `innerText`, not `textContent`: a month row stacks "September", "This
     month" and "$736" as three lines, and textContent runs them together into
     "SeptemberThis month$736" — which is then the name of a screenshot file
     and the label of a state in the report. innerText respects the layout. */
  const nameOf = (el) => (
    el.getAttribute('aria-label')
    || el.getAttribute('title')
    || (el.innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim()
    || el.getAttribute('name')
    || el.tagName.toLowerCase()
  ).slice(0, 70);

  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll(SELECTOR)) {
    if (out.length >= limit) break;
    // The console's own furniture is never the subject of a review of the app.
    if (el.closest('[data-review-ui]')) continue;
    if (el.disabled || el.getAttribute('aria-hidden') === 'true') continue;

    const box = el.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.05) continue;

    const label = nameOf(el);
    /* Twelve month cells reading "1", "2", "3" are twelve states worth
       having; twelve identical "Edit" buttons are one. The key is the label
       plus the shape of the row it sits in, which separates the first case
       from the second without a list of exceptions. */
    const key = `${label}|${el.tagName}|${Math.round(box.width)}x${Math.round(box.height)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      handle: pathOf(el),
      label,
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') ?? undefined,
      box: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) }
    });
  }
  return out;
}

/**
 * Resolve a handle, press it, and catch what starts moving.
 *
 * One call rather than two, and that is the whole reason it is shaped like
 * this. Pressing and then asking a separate question over the protocol sampled
 * the page *before* React had committed the re-render, so every state in the
 * first working run reported nothing in flight — which read as "this app does
 * not animate" and was an artefact of the measurement. Two frames inside the
 * page is after the commit and inside a 150ms transition.
 *
 * Scrolled into view first, because a control below the fold is still a
 * control and a click at its off-screen centre is not the event a person sends.
 */
export function press(handle) {
  const el = document.querySelector(handle);
  if (!el) return Promise.resolve({ ok: false, why: 'gone' });

  el.scrollIntoView({ block: 'center', behavior: 'instant' });
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  el.click();

  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const moving = typeof document.getAnimations === 'function'
        ? document.getAnimations().filter((animation) => animation.playState === 'running')
        : [];
      resolve({
        ok: true,
        inFlight: moving.slice(0, 24).map((animation) => {
          const target = animation.effect?.target;
          const timing = animation.effect?.getComputedTiming?.() ?? {};
          const cls = target?.getAttribute?.('class');
          return {
            name: animation.animationName ?? animation.transitionProperty ?? 'animation',
            kind: animation.transitionProperty ? 'transition' : 'keyframes',
            on: target ? `${target.tagName?.toLowerCase()}${cls ? `.${cls.split(/\s+/)[0]}` : ''}` : '?',
            duration: typeof timing.duration === 'number' ? Math.round(timing.duration) : undefined,
            easing: timing.easing
          };
        })
      });
    }));
  });
}

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

/**
 * Every transition, animation and transform this page's CSS declares.
 *
 * Read off `document.styleSheets` rather than by grepping the files, because
 * what is in the files is not what is in effect: the rule that wins is the
 * one the cascade picked, and a stylesheet that failed to parse is silently
 * absent here in a way `grep` would never show.
 *
 * Vite serves dev CSS as injected `<style>` with the real path on
 * `data-vite-dev-id`, so the source file is still recoverable and every entry
 * can say which file to go and edit.
 */
export function motionCss(tokens) {
  const sheets = [];
  const known = new Set(tokens);

  /* Read the authored text, not the CSSOM's idea of it.
   *
   * `rule.style.getPropertyValue('transition')` returns an empty string for
   * every rule in this codebase, and it took a run producing an inventory of
   * nothing but keyframes to notice: a shorthand whose value contains `var()`
   * cannot be serialized back out of the CSSOM, and every transition here is
   * written `transition: background-color 150ms var(--t-ease)`. The rule text
   * still has it, so that is what gets parsed. */
  const declared = (text, prop) => {
    const hit = new RegExp(`(?:^|[;{]|\\s)${prop}\\s*:\\s*([^;}]+)`, 'i').exec(text);
    return hit ? hit[1].trim().replace(/\s+/g, ' ').slice(0, 140) : '';
  };

  const durationsIn = (text) => [...String(text).matchAll(/(\d*\.?\d+)(ms|s)\b/g)]
    .map((hit) => (hit[2] === 's' ? Number(hit[1]) * 1000 : Number(hit[1])));

  const unreadable = [];

  for (const sheet of document.styleSheets) {
    const file = sheet.ownerNode?.getAttribute?.('data-vite-dev-id') ?? sheet.href ?? 'inline';
    let rules;
    try { rules = sheet.cssRules; } catch { unreadable.push(file); continue; }

    const moves = [];
    const keyframes = [];

    const walk = (list, within) => {
      for (const rule of list) {
        // 7 is @keyframes, whose child rules are the steps and not selectors.
        if (rule.type === 7) {
          keyframes.push({ name: rule.name, steps: [...rule.cssRules].map((step) => step.keyText) });
          continue;
        }
        if (rule.cssRules) {
          // @media / @supports / @layer: keep the condition, it is half of
          // what a motion rule means — `prefers-reduced-motion` above all.
          walk(rule.cssRules, rule.conditionText ? `@${rule.conditionText}` : within);
          continue;
        }
        if (!rule.selectorText) continue;

        const text = rule.cssText;
        const transition = declared(text, 'transition') || declared(text, 'transition-property');
        const animation = declared(text, 'animation') || declared(text, 'animation-name');
        const transform = declared(text, 'transform');
        if (!transition && !animation && !transform) continue;

        /* The same check `npm run debt` makes about sizes, made about time:
           a duration written as a number is a decision taken in a layout
           stylesheet that metrics.css already took. `var(--t-motion-…)` is
           the answer; `200ms` is a fourth duration nobody agreed to. */
        const offToken = durationsIn(`${transition} ${animation}`).filter((ms) => ms > 0 && !known.has(ms));

        moves.push({
          selector: rule.selectorText.slice(0, 160),
          within: within || undefined,
          transition: transition || undefined,
          animation: animation || undefined,
          transform: transform || undefined,
          offToken: offToken.length ? offToken : undefined
        });
      }
    };
    walk(rules, '');

    if (moves.length || keyframes.length) sheets.push({ file, moves, keyframes });
  }

  return { sheets, unreadable };
}

/**
 * What is currently able to move, and how it is currently drawn.
 *
 * Taken before a click and again after it, so the report can say what the
 * click actually did rather than what the stylesheet says it might do. Only
 * elements that declare motion are sampled — everything else cannot animate,
 * so a difference in it is a re-render and not an interaction.
 */
export function motionState(limit) {
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    if (out.length >= limit) break;
    if (el.closest('[data-review-ui]')) continue;
    const style = getComputedStyle(el);
    const moves = style.transitionDuration !== '0s' || style.animationName !== 'none';
    if (!moves) continue;

    const parts = [];
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${[...node.parentElement.children].indexOf(node) + 1})`);
    }
    out.push({
      handle: `html>${parts.join('>')}`,
      name: (el.getAttribute('aria-label') || (el.textContent ?? '').replace(/\s+/g, ' ').trim() || el.tagName.toLowerCase()).slice(0, 48),
      cls: el.getAttribute('class')?.split(/\s+/).slice(0, 3).join(' ') || undefined,
      transition: `${style.transitionProperty} ${style.transitionDuration} ${style.transitionTimingFunction}`,
      animation: style.animationName === 'none' ? undefined : `${style.animationName} ${style.animationDuration} ${style.animationTimingFunction}`,
      draw: {
        transform: style.transform === 'none' ? undefined : style.transform,
        opacity: style.opacity,
        height: style.height,
        background: style.backgroundColor,
        color: style.color
      }
    });
  }
  return out;
}

/**
 * How far down the content actually reaches.
 *
 * `scrollHeight` after an unfurl over-reports — a container let go of its
 * height still holds a `min-height`, and the first run produced an image a
 * third of which was empty paper. The bottom edge of the last thing drawn is
 * the honest answer, so the viewport is set from that instead.
 */
export function contentBottom() {
  let bottom = 0;
  for (const el of document.body?.querySelectorAll('*') ?? []) {
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    const box = el.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) continue;
    // Fixed furniture rides the viewport, so its bottom says how tall the
    // viewport is, not how tall the page is.
    if (style.position === 'fixed') continue;
    bottom = Math.max(bottom, box.bottom + window.scrollY);
  }
  return Math.ceil(bottom);
}
