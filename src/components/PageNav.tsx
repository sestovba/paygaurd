import type { ReactNode } from 'react';
import { Briefcase, LayoutGrid, ShieldCheck, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type PageId = 'overview' | 'income' | 'status';

export function useNavItems(): { id: PageId; label: string; icon: LucideIcon }[] {
  return [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'income', label: 'Income', icon: Briefcase },
    /* "TWP / SGA" was two abbreviations and a slash on a tab bar, in the
       one place the reader is choosing where to go. The page sets what their
       limit is, so that is what the tab is called. */
    { id: 'status', label: 'Your limit', icon: ShieldCheck }
  ];
}

function NavList({ page, onNavigate }: { page: PageId; onNavigate: (page: PageId) => void }) {
  const navItems = useNavItems();

  return (
    <>
      {navItems.map(({ id, label, icon: Icon }) => {
        return (
          <button
            key={id}
            type="button"
            aria-current={page === id ? 'page' : undefined}
            onClick={() => onNavigate(id)}
            className="nav-item"
          >
            <Icon className="size-[18px] shrink-0" />
            {label}
          </button>
        );
      })}
    </>
  );
}

/**
 * Persistent at desktop widths (lg+). Below that, down to phone width, it's
 * hidden by default and opens as a dismissible overlay from a header
 * hamburger button — a real phone gets TabBar instead, so the overlay only
 * exists in the tablet/narrow-laptop gap between the two.
 */
export function Sidebar({
  page, onNavigate, open, onClose, brand, action, footer
}: {
  page: PageId;
  onNavigate: (page: PageId) => void;
  open: boolean;
  onClose: () => void;
  /** A lockup above the nav — name and what the product is for. Optional, so
   *  a shell that already carries its brand in the top bar is unchanged. */
  brand?: ReactNode;
  /** The one thing worth doing from anywhere. Sits above the nav rather than
   *  inside it, because it is not a place you go — it is a thing you do, and
   *  a button that looks like a nav item gets read as a fourth page. */
  action?: ReactNode;
  /** Pinned to the bottom. Settings is not a destination you browse to on
   *  the way somewhere else, so it does not belong in the same list as the
   *  pages — but it does belong somewhere findable without a menu. */
  footer?: ReactNode;
}) {
  /* h-16 and a bottom rule, so the line under the brand continues the line
     under the app bar to its right instead of stopping 12px short of it —
     one unbroken rule across the top of the page, whatever is under it. It
     used to say the two "read as one L", which was true only while both were
     painted white; styles/overview.css now sits them on different planes,
     and the shared rule is what still ties them together. */
  const brandRow = brand ? (
    <div className="flex h-16 shrink-0 items-center border-b border-border px-3">{brand}</div>
  ) : null;

  const body = (
    <div className="flex flex-col gap-1 p-3">
      {action ? <div className="pb-2">{action}</div> : null}
      <NavList page={page} onNavigate={onNavigate} />
    </div>
  );

  /* flex-col, not a plain block, and that is not cosmetic. A <button> is
     shrink-to-fit even when it is `display: flex`, so the Settings row in a
     block wrapper came out 118px wide against the 199px nav items above it —
     a footer that looked like a stray chip rather than the last item in the
     list. The items above were the right width only because their wrapper is
     already a column flex container and stretched them. Same wrapper here,
     same result, and any future footer content inherits it. */
  const foot = footer ? (
    <div className="mt-auto flex flex-col border-t border-border p-3">{footer}</div>
  ) : null;

  return (
    <>
      {/* Sticky and viewport-height, not page-height. Without this the column
          grew to the length of the scrolled document, so mt-auto pinned
          Settings to the bottom of the PAGE — measured at y=2057 on an
          800px screen, which is to say invisible unless you scrolled to the
          very end of the overview to find it. */}
      <nav
        className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border lg:flex"
        aria-label="Primary"
      >
        {brandRow}
        {body}
        {foot}
      </nav>

      {open ? (
        <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="Primary">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <nav className="relative flex h-full w-64 max-w-[80vw] flex-col border-r border-border bg-surface shadow-lift">
            {/* The brand heads the drawer, so there is no second row saying
                "Menu" above a close button — the drawer already closes on the
                scrim, on Escape, and on picking a page. */}
            {brandRow}
            <div className="flex items-center justify-end px-3 pt-3">
              <button
                type="button"
                aria-label="Close menu"
                onClick={onClose}
                className="icon-btn grid text-muted-foreground hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex flex-col gap-1 p-3 pt-1">
              {action ? <div className="pb-2">{action}</div> : null}
              <NavList page={page} onNavigate={(id) => { onNavigate(id); onClose(); }} />
            </div>
            {foot}
          </nav>
        </div>
      ) : null}
    </>
  );
}

/** Bottom tab bar — only at true phone widths. Wider-but-not-desktop
 *  widths get the sidebar's overlay drawer instead, not this. */
export function TabBar({ page, onNavigate }: { page: PageId; onNavigate: (page: PageId) => void }) {
  const navItems = useNavItems();

  return (
    <nav
      className="app-bar fixed inset-x-0 bottom-0 z-20 flex border-t pb-safe sm:hidden"
      aria-label="Primary"
    >
      {navItems.map(({ id, label, icon: Icon }) => {
        return (
          <button
            key={id}
            type="button"
            aria-current={page === id ? 'page' : undefined}
            onClick={() => onNavigate(id)}
            className="nav-tab"
          >
            <span className="nav-tab-mark">
              <Icon className="size-5" />
            </span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}
