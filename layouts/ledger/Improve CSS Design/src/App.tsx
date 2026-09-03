import { useState } from "react";

type NavId = "overview" | "income" | "limit" | "settings";

const NAV_ITEMS: { id: NavId; label: string; icon: React.ReactNode }[] = [
  {
    id: "overview",
    label: "Overview",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-[18px] shrink-0">
        <rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />
      </svg>
    ),
  },
  {
    id: "income",
    label: "Income",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-[18px] shrink-0">
        <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /><rect width="20" height="14" x="2" y="6" rx="2" />
      </svg>
    ),
  },
  {
    id: "limit",
    label: "Your limit",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-[18px] shrink-0">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-[18px] shrink-0">
        <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

const INCOME_STREAMS = [
  { id: 1, name: "Riverside Market", type: "W-2" as const, ytd: 12345, color: "var(--color-good)" },
  { id: 2, name: "Delivery driving", type: "1099" as const, ytd: 2385, color: "var(--color-info)" },
];

const MONTH_PAYDAYS = [
  { employer: "Riverside Market", days: [7, 21] },
];

const TRIAL_MONTHS = [
  { used: true, warn: false },
  { used: true, warn: false },
  { used: true, warn: true },
  { used: true, warn: true },
  { used: true, warn: true },
  { used: true, warn: true },
  { used: true, warn: true },
  { used: true, warn: true },
  { used: false, warn: false },
];

function DollarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
      <line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function PrecisionGauge({ pct }: { pct: number }) {
  const r = 60;
  const cx = 70, cy = 70;
  const startAngle = Math.PI;
  const endAngle = 0;
  const arcLen = Math.PI * r;
  const filled = (pct / 100) * arcLen;

  const pathD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <div>
      <div className="precision-gauge-dial">
        <svg viewBox="0 0 140 78" role="img" aria-label={`Confidence ${pct} percent`}>
          <path className="precision-gauge-track" d={pathD} />
          <path className="precision-gauge-fill" d={pathD} strokeDasharray={`${filled} ${arcLen}`} />
        </svg>
        <div className="precision-gauge-read">
          <span className="precision-gauge-pct">{pct}<small>%</small></span>
          <span className="precision-gauge-word">Confidence</span>
        </div>
        <span className="precision-gauge-end" data-end="lo" aria-hidden="true">0%</span>
        <span className="precision-gauge-end" data-end="hi" aria-hidden="true">100%</span>
      </div>
      <p className="precision-gauge-note">
        <strong>Tell us 1 more thing and this number becomes exact</strong>
        <span>Riverside Market · add a paystub</span>
      </p>
      <button className="precision-gauge-go">Improve accuracy <span aria-hidden="true">→</span></button>
    </div>
  );
}

function OverviewPage() {
  const [expandedStream, setExpandedStream] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-8">
      {/* Page header */}
      <div>
        <p className="label-caps" style={{ color: "var(--color-primary)" }}>September 2026</p>
        <h1 className="display-figure mt-1 text-4xl sm:text-5xl" style={{ color: "var(--color-foreground)" }}>Overview</h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-muted)", maxWidth: "52ch" }}>
          What you have earned this month, how much headroom remains, and which months pay you an extra time.
        </p>
      </div>

      {/* Primary cards */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* Status card */}
        <div className="panel p-5 sm:p-6 flex flex-col gap-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="label-caps">September so far</p>
              <p className="display-figure mt-1.5 text-5xl sm:text-6xl" style={{ color: "var(--color-good)" }}>$897</p>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: "var(--color-good-soft)", color: "var(--color-good-text)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
              </svg>
              Safe
            </span>
          </div>

          <p className="mt-5 text-base font-semibold leading-snug" style={{ color: "var(--color-foreground)" }}>
            $103 left before the $1,000 we aim for. $1,210 is the limit.
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>About 4 more hours of work at $22 an hour.</p>

          {/* Progress bar */}
          <div className="mt-5 space-y-1.5">
            <div className="flex justify-between text-xs font-medium" style={{ color: "var(--color-muted)" }}>
              <span className="num">$0</span>
              <span className="num">$897 earned</span>
              <span className="num">$1,210 limit</span>
            </div>
            <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
              {/* Aim zone */}
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(1000 / 1210) * 100}%`, background: "var(--color-good-soft)" }} />
              {/* Earned */}
              <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${(897 / 1210) * 100}%`, background: "var(--color-good)" }} />
              {/* Aim marker */}
              <div className="absolute inset-y-0 w-px" style={{ left: `${(1000 / 1210) * 100}%`, background: "var(--color-good-text)", opacity: 0.4 }} />
            </div>
            <div className="flex justify-between text-xs" style={{ color: "var(--color-dim)" }}>
              <span></span>
              <span>aim: $1,000</span>
            </div>
          </div>

          {/* Gauge */}
          <div className="mt-6 pt-5" style={{ borderTop: "1px solid var(--color-border)" }}>
            <PrecisionGauge pct={67} />
          </div>

          {/* Trial months */}
          <div className="mt-6 pt-5" style={{ borderTop: "1px solid var(--color-border)" }}>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>8 of your 9 trial work months used</p>
            <div className="mt-2.5 grid grid-cols-9 gap-1.5" role="img" aria-label="8 of 9 trial work months used">
              {TRIAL_MONTHS.map((m, i) => (
                <span
                  key={i}
                  className="h-1.5 rounded-full"
                  style={{
                    background: !m.used
                      ? "var(--color-border)"
                      : m.warn
                      ? "var(--color-warn)"
                      : "var(--color-dim)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Extra months */}
          <div className="panel p-5 sm:p-6">
            <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--color-info)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
                <path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" />
              </svg>
              Months that pay you extra
            </p>
            <div className="mt-3 rounded-lg p-3 sm:p-4" style={{ border: "1px solid color-mix(in oklab, var(--color-good) 30%, transparent)", background: "color-mix(in oklab, var(--color-good-soft) 60%, transparent)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--color-good-text)" }}>No month ahead pays you an extra time</p>
            </div>
          </div>

          {/* September month card */}
          <div className="panel p-5 sm:p-6 flex-1">
            <h2 className="display-figure text-3xl" style={{ color: "var(--color-foreground)" }}>September</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>$897 counted so far · Under your limit</p>
            <div className="mt-5 flex flex-col gap-4">
              {MONTH_PAYDAYS.map((job, i) => (
                <div key={i}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>{job.employer}</p>
                    <p className="text-sm" style={{ color: "var(--color-muted)" }}>{job.days.length} paydays</p>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {job.days.map((d) => (
                      <li key={d} className="num grid size-9 place-items-center rounded-lg border text-sm font-semibold" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-foreground)" }}>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <button className="mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ background: "var(--color-primary)" }}>
              Open September
            </button>
          </div>
        </div>
      </div>

      {/* Income section */}
      <div>
        <p className="label-caps mb-3">Income sources</p>
        <div className="panel overflow-hidden">
          <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {INCOME_STREAMS.map((stream) => (
              <li key={stream.id}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-3 text-left"
                    onClick={() => setExpandedStream(expandedStream === stream.id ? null : stream.id)}
                  >
                    <span className="h-5 w-0.5 shrink-0 rounded-full" style={{ background: stream.color }} />
                    <span className="truncate text-sm font-medium" style={{ color: "var(--color-foreground)" }}>{stream.name}</span>
                  </button>
                  <span className="flex shrink-0 items-center gap-3">
                    <span
                      className="rounded px-2 py-0.5 text-xs font-semibold"
                      style={
                        stream.type === "W-2"
                          ? { background: "var(--color-good-soft)", color: "var(--color-good-text)" }
                          : { background: "var(--color-info-soft)", color: "var(--color-info-text)" }
                      }
                    >
                      {stream.type}
                    </span>
                    <span className="num text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
                      ${stream.ytd.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      aria-label="Expand details"
                      onClick={() => setExpandedStream(expandedStream === stream.id ? null : stream.id)}
                      className="grid size-7 place-items-center rounded-md transition-colors hover:opacity-70"
                      style={{ color: "var(--color-dim)" }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 transition-transform" style={{ transform: expandedStream === stream.id ? "rotate(180deg)" : "rotate(0deg)" }} aria-hidden="true">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                  </span>
                </div>
                {expandedStream === stream.id && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="rounded-lg p-4 text-sm" style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}>
                      <p>YTD earnings: <span className="num font-semibold" style={{ color: "var(--color-foreground)" }}>${stream.ytd.toLocaleString()}</span></p>
                      <p className="mt-1">No additional details yet — add a paystub to improve your confidence score.</p>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="flex gap-2 border-t p-4" style={{ borderColor: "var(--color-border)" }}>
            <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors hover:opacity-80" style={{ background: "var(--color-good-soft)", color: "var(--color-good-text)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
                <path d="M5 12h14" /><path d="M12 5v14" />
              </svg>
              A job that pays me
            </button>
            <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors hover:opacity-80" style={{ background: "var(--color-info-soft)", color: "var(--color-info-text)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
                <path d="M5 12h14" /><path d="M12 5v14" />
              </svg>
              Delivery or gig work
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function IncomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="label-caps" style={{ color: "var(--color-primary)" }}>All income</p>
        <h1 className="display-figure mt-1 text-4xl" style={{ color: "var(--color-foreground)" }}>Income</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--color-muted)", maxWidth: "52ch" }}>Your jobs and gig work for the year.</p>
      </div>
      <div className="panel p-8 text-center" style={{ color: "var(--color-dim)" }}>
        <p className="text-sm">Income detail view</p>
      </div>
    </div>
  );
}

function LimitPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="label-caps" style={{ color: "var(--color-primary)" }}>Medicaid SGA</p>
        <h1 className="display-figure mt-1 text-4xl" style={{ color: "var(--color-foreground)" }}>Your limit</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--color-muted)", maxWidth: "52ch" }}>The Medicaid threshold that determines your eligibility.</p>
      </div>
      <div className="panel p-8 text-center" style={{ color: "var(--color-dim)" }}>
        <p className="text-sm">Limit configuration</p>
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="display-figure text-4xl" style={{ color: "var(--color-foreground)" }}>Settings</h1>
      </div>
      <div className="panel p-8 text-center" style={{ color: "var(--color-dim)" }}>
        <p className="text-sm">Settings</p>
      </div>
    </div>
  );
}

const PAGE_MAP: Record<NavId, React.ReactNode> = {
  overview: <OverviewPage />,
  income: <IncomePage />,
  limit: <LimitPage />,
  settings: <SettingsPage />,
};

export default function App() {
  const [nav, setNav] = useState<NavId>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const primaryNav = NAV_ITEMS.filter((n) => n.id !== "settings");
  const settingsItem = NAV_ITEMS.find((n) => n.id === "settings")!;

  return (
    <div className="flex h-full overflow-hidden" style={{ background: "var(--color-background)" }}>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-30 flex w-60 shrink-0 flex-col transition-transform duration-200 lg:static lg:translate-x-0 lg:z-auto"
        style={{
          background: "var(--color-surface)",
          borderRight: "1px solid var(--color-border)",
          transform: sidebarOpen ? "translateX(0)" : undefined,
        }}
        aria-hidden={!sidebarOpen}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-5" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ background: "var(--color-primary)", color: "#fff", boxShadow: "0 2px 8px color-mix(in oklab, var(--color-primary) 40%, transparent)" }}>
            <DollarIcon />
          </span>
          <div>
            <p className="text-sm font-bold tracking-tight" style={{ color: "var(--color-foreground)" }}>PayGuard</p>
            <p className="label-caps" style={{ fontSize: "0.5625rem" }}>Stay under the limit</p>
          </div>
        </div>

        {/* Add income CTA */}
        <div className="px-4 pt-4">
          <button className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ background: "var(--color-primary)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
              <path d="M5 12h14" /><path d="M12 5v14" />
            </svg>
            Add income
          </button>
        </div>

        {/* Primary nav */}
        <nav className="mt-3 flex flex-col gap-0.5 px-3" aria-label="Primary">
          {primaryNav.map((item) => {
            const active = nav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => { setNav(item.id); setSidebarOpen(false); }}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors"
                style={
                  active
                    ? { background: "var(--color-nav-active-bg)", color: "var(--color-nav-active-text)" }
                    : { color: "var(--color-muted)" }
                }
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Settings at bottom */}
        <div className="mt-auto p-3" style={{ borderTop: "1px solid var(--color-border)" }}>
          <button
            type="button"
            onClick={() => { setNav("settings"); setSidebarOpen(false); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
            style={nav === "settings" ? { background: "var(--color-nav-active-bg)", color: "var(--color-nav-active-text)" } : { color: "var(--color-muted)" }}
          >
            {settingsItem.icon}
            {settingsItem.label}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header
          className="flex h-16 shrink-0 items-center gap-3 px-4 sm:px-6"
          style={{ background: "var(--color-background)", borderBottom: "1px solid var(--color-border)" }}
        >
          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setSidebarOpen(true)}
            className="grid size-9 place-items-center rounded-lg border transition-colors hover:opacity-70 lg:hidden"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-muted)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
              <path d="M4 5h16" /><path d="M4 12h16" /><path d="M4 19h16" />
            </svg>
          </button>

          {/* Mobile logo (hidden on desktop since sidebar shows it) */}
          <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
            <span className="grid size-8 shrink-0 place-items-center rounded-md" style={{ background: "var(--color-primary)", color: "#fff" }}>
              <DollarIcon />
            </span>
            <p className="text-sm font-bold tracking-tight" style={{ color: "var(--color-foreground)" }}>PayGuard</p>
          </div>

          {/* Desktop breadcrumb */}
          <div className="hidden min-w-0 flex-1 lg:block">
            <p className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
              {NAV_ITEMS.find((n) => n.id === nav)?.label}
            </p>
          </div>

          {/* Year stepper */}
          <div className="flex items-center gap-1 rounded-full border px-1 py-1" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
            <button className="grid size-7 place-items-center rounded-full transition-colors hover:opacity-70" style={{ color: "var(--color-muted)" }} aria-label="Previous year">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <span className="num min-w-11 px-1 text-center text-xs font-bold" style={{ color: "var(--color-foreground)" }}>2026</span>
            <button className="grid size-7 place-items-center rounded-full opacity-30" style={{ color: "var(--color-muted)" }} aria-label="Next year" disabled>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>

          {/* Bell */}
          <button
            className="grid size-9 place-items-center rounded-lg border transition-colors hover:opacity-70"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-muted)" }}
            aria-label="Notifications"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
              <path d="M10.268 21a2 2 0 0 0 3.464 0" />
              <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
            </svg>
          </button>
        </header>

        {/* Scrollable page content */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 pb-28 sm:pb-8">
            {PAGE_MAP[nav]}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav
          className="flex shrink-0 border-t sm:hidden"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
          aria-label="Primary"
        >
          {primaryNav.map((item) => {
            const active = nav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setNav(item.id)}
                className="flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors"
                style={{ color: active ? "var(--color-primary)" : "var(--color-muted)" }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
