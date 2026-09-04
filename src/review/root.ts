// Which document the page is in, and where it sits on screen.
//
// The console used to be able to assume both: the app rendered in the same
// document, at the origin. Reviewing at a phone width broke the assumption —
// the page is rendered in a frame so its own media queries resolve against a
// real viewport, which makes it a separate document sitting at an offset,
// possibly scaled to fit.
//
// Everything that reaches into the PAGE goes through here. Everything that
// draws the console's own UI keeps using `document` directly, and the split
// is deliberate: those are two different documents now, and code that does
// not say which one it means is code that works at one width only.

let page: Document = document;
let host: HTMLIFrameElement | null = null;

export function setPageDocument(doc: Document | null, frame: HTMLIFrameElement | null): void {
  page = doc ?? document;
  host = frame;
}

/** The document the app is rendered in. The window's own, unless framed. */
export function pageDocument(): Document {
  return page;
}

/**
 * Page coordinates → console coordinates.
 *
 * A rect read inside the frame is relative to the frame's viewport; the
 * overlay that draws it lives in this window. Without this the outline is
 * drawn in the top-left corner while the element it names is in the middle
 * of the screen — which is how a pointer that "does not work" usually looks.
 *
 * `scale` is not always 1: a 393×852 phone does not fit vertically in a short
 * window, so the frame is scaled down to fit and its CSS pixels stop being
 * this window's pixels.
 */
export function toConsoleRect(box: DOMRect): DOMRect {
  if (!host) return box;
  const frame = host.getBoundingClientRect();
  const scale = host.offsetWidth ? frame.width / host.offsetWidth : 1;
  return new DOMRect(
    frame.left + box.left * scale,
    frame.top + box.top * scale,
    box.width * scale,
    box.height * scale
  );
}

/** Console coordinates → page coordinates, for hit-testing under the cursor. */
export function toPagePoint(x: number, y: number): { x: number; y: number } | null {
  if (!host) return { x, y };
  const frame = host.getBoundingClientRect();
  const scale = host.offsetWidth ? frame.width / host.offsetWidth : 1;
  if (!scale) return null;
  const inX = (x - frame.left) / scale;
  const inY = (y - frame.top) / scale;
  // Outside the frame is not "the edge of the page" — it is the grey around
  // it, and pointing there should find nothing rather than the nearest thing.
  if (inX < 0 || inY < 0 || inX > host.offsetWidth || inY > host.offsetHeight) return null;
  return { x: inX, y: inY };
}
