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
        const active = page === id;
        return (
          <button
            key={id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate(id)}
            className={
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-colors '
              + (active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')
            }
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
  page, onNavigate, open, onClose
}: {
  page: PageId;
  onNavigate: (page: PageId) => void;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border p-3 lg:flex" aria-label="Primary">
        <NavList page={page} onNavigate={onNavigate} />
      </nav>

      {open ? (
        <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="Primary">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <nav className="relative flex h-full w-64 max-w-[80vw] flex-col gap-1 border-r border-border bg-surface p-3 shadow-lift">
            <div className="mb-2 flex items-center justify-between px-1 py-1">
              <span className="text-base font-semibold">Menu</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={onClose}
                className="icon-btn grid text-muted-foreground hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>
            <NavList page={page} onNavigate={(id) => { onNavigate(id); onClose(); }} />
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
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-background/95 backdrop-blur pb-safe sm:hidden"
      aria-label="Primary"
    >
      {navItems.map(({ id, label, icon: Icon }) => {
        const active = page === id;
        return (
          <button
            key={id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate(id)}
            className={
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-sm font-medium transition-colors '
              + (active ? 'text-good' : 'text-muted-foreground')
            }
          >
            <Icon className="size-5" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
