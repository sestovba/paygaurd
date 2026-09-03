import { useState, useMemo } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

type Source = { id: string; name: string; type: 'W-2' | '1099'; rate?: number };
type Entry = { id: string; sid: string; amount: number; hours?: number; mo: number; yr: number };

// ── Constants ──────────────────────────────────────────────────────────────

const SAFE_LIMIT = 1_000;
const HARD_LIMIT = 1_210;
const GAUGE_MAX = 1_500;
const NOW_MONTH = 8; // September, 0-indexed
const NOW_YEAR = 2026;
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MO_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ── Seed data ──────────────────────────────────────────────────────────────

const SOURCES: Source[] = [
  { id: 's1', name: 'Riverside Market', type: 'W-2', rate: 21.50 },
  { id: 's2', name: 'Delivery driving', type: '1099' },
];

const INIT_ENTRIES: Entry[] = [
  { id: 'e1',  sid: 's1', amount: 920,  hours: 42, mo: 0, yr: 2026 },
  { id: 'e2',  sid: 's1', amount: 780,  hours: 36, mo: 1, yr: 2026 },
  { id: 'e3',  sid: 's1', amount: 1050, hours: 48, mo: 2, yr: 2026 },
  { id: 'e4',  sid: 's2', amount: 120,             mo: 2, yr: 2026 },
  { id: 'e5',  sid: 's1', amount: 650,  hours: 30, mo: 3, yr: 2026 },
  { id: 'e6',  sid: 's1', amount: 880,  hours: 40, mo: 4, yr: 2026 },
  { id: 'e7',  sid: 's2', amount: 195,             mo: 4, yr: 2026 },
  { id: 'e8',  sid: 's1', amount: 920,  hours: 42, mo: 5, yr: 2026 },
  { id: 'e9',  sid: 's1', amount: 845,  hours: 39, mo: 6, yr: 2026 },
  { id: 'e10', sid: 's2', amount: 180,             mo: 6, yr: 2026 },
  { id: 'e11', sid: 's1', amount: 940,  hours: 43, mo: 7, yr: 2026 },
  { id: 'e12', sid: 's1', amount: 860,  hours: 40, mo: 8, yr: 2026 },
  { id: 'e13', sid: 's2', amount: 210,  hours: 12, mo: 8, yr: 2026 },
];

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  '$' + Math.round(n).toLocaleString('en-US');

const fmtRate = (n: number) =>
  '$' + n.toFixed(2);

type Zone = 'safe' | 'careful' | 'over' | 'empty';

function zoneOf(amount: number): Zone {
  if (amount <= 0) return 'empty';
  if (amount <= SAFE_LIMIT) return 'safe';
  if (amount <= HARD_LIMIT) return 'careful';
  return 'over';
}

const ZONE_COLOR: Record<Zone, string> = {
  safe:    '#10b981',
  careful: '#f59e0b',
  over:    '#ef4444',
  empty:   '#2e3240',
};
const ZONE_BG: Record<Zone, string> = {
  safe:    'rgba(16, 185, 129, 0.1)',
  careful: 'rgba(245, 158, 11, 0.1)',
  over:    'rgba(239, 68, 68, 0.1)',
  empty:   'transparent',
};
const ZONE_LABEL: Record<Zone, string> = {
  safe:    'Safe',
  careful: 'Careful',
  over:    'Over limit',
  empty:   'No data',
};

// ── Shared micro-styles ────────────────────────────────────────────────────

const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const SLAB: React.CSSProperties = { fontFamily: "'Roboto Slab', serif" };
const SECTION_LABEL: React.CSSProperties = {
  ...MONO,
  fontSize: 10,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#5d6370',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 16,
};
const HAIRLINE: React.CSSProperties = { flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' };

// ── Gauge component ────────────────────────────────────────────────────────

function Gauge({ total, accentColor }: { total: number; accentColor: string }) {
  const fillPct  = Math.min((total / GAUGE_MAX) * 100, 100);
  const safePct  = (SAFE_LIMIT / GAUGE_MAX) * 100;
  const hardPct  = (HARD_LIMIT / GAUGE_MAX) * 100;

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        {/* Zone backgrounds */}
        <div style={{
          height: 8, borderRadius: 4, overflow: 'hidden',
          background: '#1a1e27', position: 'relative',
        }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${safePct}%`, background: 'rgba(16,185,129,0.13)' }} />
          <div style={{ position: 'absolute', left: `${safePct}%`, top: 0, bottom: 0, width: `${hardPct - safePct}%`, background: 'rgba(245,158,11,0.13)' }} />
          <div style={{ position: 'absolute', left: `${hardPct}%`, top: 0, bottom: 0, right: 0, background: 'rgba(239,68,68,0.13)' }} />
          {/* Earned fill */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${fillPct}%`,
            background: accentColor,
            transition: 'width 0.45s cubic-bezier(0.4,0,0.2,1), background 0.3s',
            borderRadius: 4,
          }} />
        </div>
        {/* Threshold hairlines */}
        <div style={{ position: 'absolute', left: `${safePct}%`, top: -4, bottom: -4, width: 1, background: 'rgba(255,255,255,0.22)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: `${hardPct}%`, top: -4, bottom: -4, width: 1, background: 'rgba(255,255,255,0.22)', pointerEvents: 'none' }} />
      </div>
      {/* Labels below */}
      <div style={{ position: 'relative', height: 16 }}>
        <span style={{ ...MONO, position: 'absolute', fontSize: 9, color: '#5d6370', left: 0 }}>$0</span>
        <span style={{
          ...MONO, position: 'absolute', fontSize: 9, color: '#5d6370',
          left: `${safePct}%`, transform: 'translateX(-50%)',
        }}>$1,000</span>
        <span style={{
          ...MONO, position: 'absolute', fontSize: 9, color: '#5d6370',
          left: `${hardPct}%`, transform: 'translateX(-50%)',
        }}>$1,210</span>
      </div>
    </div>
  );
}

// ── Year runway cell ───────────────────────────────────────────────────────

function MonthCell({ label, total, isCurrent, isFuture, accentColor }: {
  label: string; total: number; isCurrent: boolean; isFuture: boolean; accentColor: string;
}) {
  const zone = isFuture ? 'empty' : zoneOf(total);
  const color = isCurrent ? accentColor : ZONE_COLOR[zone];
  const fillPct = isFuture ? 0 : Math.min((total / HARD_LIMIT) * 100, 100);

  return (
    <div style={{
      background: isCurrent ? 'rgba(255,255,255,0.04)' : '#161921',
      border: isCurrent ? `1px solid ${accentColor}44` : '1px solid rgba(255,255,255,0.05)',
      borderRadius: 8,
      padding: '8px 7px 7px',
      boxShadow: isCurrent ? `0 0 0 1px ${accentColor}18` : 'none',
      transition: 'border-color 0.3s',
    }}>
      <div style={{
        ...MONO, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
        color: isCurrent ? accentColor : isFuture ? '#252831' : '#4a505d',
        marginBottom: 7,
      }}>{label}</div>
      <div style={{ height: 3, borderRadius: 2, background: '#1a1e27', marginBottom: 7, overflow: 'hidden' }}>
        {!isFuture && fillPct > 0 && (
          <div style={{
            height: '100%', width: `${fillPct}%`,
            background: color, borderRadius: 2,
            transition: 'width 0.4s ease',
          }} />
        )}
      </div>
      <div style={{
        ...MONO, fontSize: 9,
        color: isFuture ? '#252831' : zone === 'empty' ? '#343843' : color,
      }}>
        {isFuture ? '—' : total > 0 ? fmt(total) : '—'}
      </div>
    </div>
  );
}

// ── Main app ───────────────────────────────────────────────────────────────

export default function App() {
  const [entries, setEntries] = useState<Entry[]>(INIT_ENTRIES);
  const [sid, setSid] = useState('s1');
  const [amt, setAmt] = useState('');
  const [hrs, setHrs] = useState('');
  const [showAll, setShowAll] = useState(false);
  const TRIAL_USED = 8;

  // Derived state
  const curEntries = useMemo(
    () => entries.filter(e => e.mo === NOW_MONTH && e.yr === NOW_YEAR),
    [entries]
  );

  const total = useMemo(
    () => curEntries.reduce((s, e) => s + e.amount, 0),
    [curEntries]
  );

  const zone = zoneOf(total);
  const accent = ZONE_COLOR[zone];
  const safeRoom = Math.max(0, SAFE_LIMIT - total);
  const hardRoom = Math.max(0, HARD_LIMIT - total);
  const primarySrc = SOURCES[0];
  const rate = primarySrc.rate!;
  const safeHrs = Math.floor(safeRoom / rate);
  const hardHrs = Math.floor(hardRoom / rate);

  const moTotals = useMemo(() => {
    const t = new Array(12).fill(0);
    entries.filter(e => e.yr === NOW_YEAR).forEach(e => { t[e.mo] += e.amount; });
    return t;
  }, [entries]);

  const selectedSrc = SOURCES.find(s => s.id === sid);
  const parsedAmt = parseFloat(amt);
  const parsedHrs = parseFloat(hrs);
  const estimatedAmt = selectedSrc?.rate && hrs && !isNaN(parsedHrs)
    ? parsedHrs * selectedSrc.rate
    : null;
  const canAdd = !isNaN(parsedAmt) && parsedAmt > 0;

  function addEntry() {
    if (!canAdd) return;
    setEntries(prev => [...prev, {
      id: 'n' + Date.now(),
      sid,
      amount: parsedAmt,
      hours: hrs && !isNaN(parsedHrs) ? parsedHrs : undefined,
      mo: NOW_MONTH,
      yr: NOW_YEAR,
    }]);
    setAmt('');
    setHrs('');
  }

  const displayedEntries = useMemo(() => {
    const sorted = [...curEntries].sort((a, b) => b.amount - a.amount);
    return showAll ? sorted : sorted.slice(0, 3);
  }, [curEntries, showAll]);

  // Hero display
  const heroValue = zone === 'safe'
    ? (safeHrs === 0 ? '<1' : String(safeHrs))
    : zone === 'careful'
    ? (hardHrs === 0 ? '<1' : String(hardHrs))
    : fmt(total - HARD_LIMIT);
  const heroUnit = zone === 'over' ? 'over the limit' : safeHrs === 1 ? 'hour' : 'hours';
  const heroSub = zone === 'safe'
    ? `of safe work left · ${fmt(safeRoom)} headroom`
    : zone === 'careful'
    ? `to the hard cap · ${fmt(hardRoom)} remaining`
    : 'stop work this month';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0e1015',
      color: '#e4e6ec',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      maxWidth: 480,
      margin: '0 auto',
    }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#0e1015',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '11px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em', color: '#e4e6ec' }}>
            PayGuard
          </span>
          <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ ...MONO, fontSize: 11, color: '#5d6370' }}>
            {MO_FULL[NOW_MONTH]} {NOW_YEAR}
          </span>
        </div>
        <button style={{
          background: 'none', border: 'none', color: '#5d6370',
          cursor: 'pointer', padding: 4, lineHeight: 0,
          borderRadius: 6, transition: 'color 0.15s',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </header>

      {/* ── Hero — The Answer ───────────────────────────────────────────── */}
      <section style={{ padding: '28px 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={SECTION_LABEL}>
          <span>This month</span>
          <div style={HAIRLINE} />
        </div>

        {/* Big number */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            ...SLAB,
            fontSize: 76, fontWeight: 300, lineHeight: 1,
            letterSpacing: '-0.03em',
            color: zone === 'over' ? accent : '#e8eaef',
            transition: 'color 0.3s',
          }}>
            {heroValue}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5 }}>
            <span style={{ fontSize: 16, color: '#9aa0ad', fontWeight: 400 }}>
              {heroUnit}
            </span>
            <span style={{ fontSize: 14, color: '#5d6370' }}>{heroSub}</span>
          </div>
        </div>

        {/* Status chip */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '5px 11px', borderRadius: 999,
          background: ZONE_BG[zone],
          border: `1px solid ${accent}30`,
          marginBottom: 20,
          transition: 'background 0.3s, border-color 0.3s',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
          <span style={{ ...MONO, fontSize: 11, fontWeight: 600, color: accent }}>{ZONE_LABEL[zone]}</span>
          <span style={{ ...MONO, fontSize: 11, color: '#5d6370' }}>·</span>
          <span style={{ ...MONO, fontSize: 11, color: '#9aa0ad' }}>{fmt(total)} earned</span>
        </div>

        {/* Gauge */}
        <Gauge total={total} accentColor={accent} />

        {/* Rate footnote */}
        <div style={{ ...MONO, fontSize: 11, color: '#4a505d', marginTop: 10 }}>
          {fmtRate(rate)}/hr at Riverside Market · {hardHrs} hrs to the hard cap
        </div>
      </section>

      {/* ── Year Runway ─────────────────────────────────────────────────── */}
      <section style={{ padding: '20px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={SECTION_LABEL}>
          <span>{NOW_YEAR} runway</span>
          <div style={HAIRLINE} />
          <span style={{ fontSize: 10, color: '#343843' }}>oct–dec projected</span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 5,
        }}>
          {MO.map((mo, i) => (
            <MonthCell
              key={mo}
              label={mo}
              total={moTotals[i]}
              isCurrent={i === NOW_MONTH}
              isFuture={i > NOW_MONTH}
              accentColor={accent}
            />
          ))}
        </div>

        {/* Year summary chips */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {(['safe', 'careful', 'over'] as Zone[]).map(z => {
            const count = MO.slice(0, NOW_MONTH + 1).filter((_, i) =>
              i < NOW_MONTH && zoneOf(moTotals[i]) === z
            ).length;
            if (count === 0) return null;
            return (
              <div key={z} style={{
                ...MONO, fontSize: 10,
                padding: '4px 10px', borderRadius: 4,
                background: ZONE_BG[z],
                color: ZONE_COLOR[z],
                border: `1px solid ${ZONE_COLOR[z]}22`,
              }}>
                {count} {ZONE_LABEL[z].toLowerCase()}
              </div>
            );
          })}
          <div style={{
            ...MONO, fontSize: 10,
            padding: '4px 10px', borderRadius: 4,
            background: 'rgba(255,255,255,0.04)',
            color: '#5d6370',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            {9 - TRIAL_USED} trial month left
          </div>
        </div>
      </section>

      {/* ── Log income ──────────────────────────────────────────────────── */}
      <section style={{ padding: '20px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={SECTION_LABEL}>
          <span>Log income</span>
          <div style={HAIRLINE} />
        </div>

        {/* Source selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {SOURCES.map(src => {
            const active = sid === src.id;
            return (
              <button key={src.id} onClick={() => setSid(src.id)} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '7px 14px', borderRadius: 999,
                border: `1px solid ${active ? accent + '55' : 'rgba(255,255,255,0.08)'}`,
                background: active ? ZONE_BG[zone] : 'transparent',
                color: active ? accent : '#9aa0ad',
                fontSize: 13, fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}>
                {src.name}
                <span style={{
                  ...MONO, fontSize: 9, letterSpacing: '0.06em',
                  color: active ? accent + 'aa' : '#3a3e47',
                  background: active ? accent + '18' : '#1a1e27',
                  padding: '2px 5px', borderRadius: 3,
                }}>
                  {src.type}
                </span>
              </button>
            );
          })}
        </div>

        {/* Inputs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <label style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 4,
            background: '#161921',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '0 14px',
            transition: 'border-color 0.15s',
          }}>
            <span style={{ ...MONO, fontSize: 14, color: '#5d6370' }}>$</span>
            <input
              type="number" inputMode="decimal" placeholder="0"
              value={amt} onChange={e => setAmt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addEntry()}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: '#e4e6ec', fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                padding: '13px 0',
              }}
            />
          </label>
          {selectedSrc?.rate && (
            <label style={{
              width: 80, display: 'flex', alignItems: 'center',
              background: '#161921',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, padding: '0 12px',
            }}>
              <input
                type="number" inputMode="decimal" placeholder="hrs"
                value={hrs} onChange={e => setHrs(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addEntry()}
                style={{
                  width: '100%', background: 'none', border: 'none', outline: 'none',
                  color: '#e4e6ec', fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  padding: '13px 0',
                }}
              />
            </label>
          )}
        </div>

        {/* Estimate hint */}
        {estimatedAmt && (
          <div style={{ ...MONO, fontSize: 11, color: '#5d6370', marginBottom: 10 }}>
            {hrs} hrs × {fmtRate(selectedSrc!.rate!)} ≈ {fmt(estimatedAmt)} estimated
          </div>
        )}

        <button onClick={addEntry} disabled={!canAdd} style={{
          width: '100%', padding: '13px 0', borderRadius: 8, border: 'none',
          background: canAdd ? accent : '#1a1e27',
          color: canAdd ? '#0e1015' : '#343843',
          fontSize: 14, fontWeight: 600,
          cursor: canAdd ? 'pointer' : 'not-allowed',
          transition: 'background 0.2s, color 0.2s',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          letterSpacing: '-0.01em',
        }}>
          Add entry
        </button>
      </section>

      {/* ── September entries ───────────────────────────────────────────── */}
      <section style={{ padding: '20px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={SECTION_LABEL}>
          <span>September entries</span>
          <div style={HAIRLINE} />
          <span style={{ color: '#343843' }}>{curEntries.length}</span>
        </div>

        <div>
          {displayedEntries.map(e => {
            const src = SOURCES.find(s => s.id === e.sid)!;
            const srcColor = src.type === 'W-2' ? '#10b981' : '#60a5fa';
            return (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  background: src.type === 'W-2' ? 'rgba(16,185,129,0.1)' : 'rgba(96,165,250,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{
                    ...MONO, fontSize: 8, letterSpacing: '0.06em',
                    color: srcColor, fontWeight: 600,
                  }}>
                    {src.type}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#c8cad4', marginBottom: 2 }}>
                    {src.name}
                  </div>
                  {e.hours && (
                    <div style={{ ...MONO, fontSize: 10, color: '#5d6370' }}>
                      {e.hours} hrs · {fmtRate(e.amount / e.hours)}/hr
                    </div>
                  )}
                </div>
                <div style={{ ...MONO, fontSize: 16, fontWeight: 600, color: '#e4e6ec' }}>
                  {fmt(e.amount)}
                </div>
              </div>
            );
          })}
        </div>

        {curEntries.length > 3 && (
          <button onClick={() => setShowAll(!showAll)} style={{
            marginTop: 10, background: 'none', border: 'none',
            color: '#5d6370', fontSize: 12, cursor: 'pointer', padding: 0,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.04em',
          }}>
            {showAll ? '↑ show less' : `↓ all ${curEntries.length} entries`}
          </button>
        )}
      </section>

      {/* ── Trial work months ───────────────────────────────────────────── */}
      <section style={{ padding: '20px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={SECTION_LABEL}>
          <span>Trial work months</span>
          <div style={HAIRLINE} />
          <span style={{ color: '#f59e0b' }}>{TRIAL_USED} of 9</span>
        </div>

        <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
          {Array.from({ length: 9 }).map((_, i) => {
            const used = i < TRIAL_USED;
            return (
              <div key={i} style={{
                flex: 1, height: 28, borderRadius: 5,
                background: used ? 'rgba(245,158,11,0.12)' : '#161921',
                border: `1px solid ${used ? '#f59e0b33' : 'rgba(255,255,255,0.05)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {used && (
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b' }} />
                )}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: '#5d6370', lineHeight: 1.6 }}>
          {TRIAL_USED} used · {9 - TRIAL_USED} remaining. Earn any amount in a trial month without losing benefits. They don't come back once used.
        </div>
      </section>

      {/* ── Income sources ──────────────────────────────────────────────── */}
      <section style={{ padding: '20px 20px', borderBottom: 'none' }}>
        <div style={SECTION_LABEL}>
          <span>Income sources</span>
          <div style={HAIRLINE} />
        </div>

        {SOURCES.map(src => {
          const srcTotal = curEntries.filter(e => e.sid === src.id).reduce((s, e) => s + e.amount, 0);
          const srcColor = src.type === 'W-2' ? '#10b981' : '#60a5fa';
          return (
            <div key={src.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 14px',
              background: '#161921',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 10, marginBottom: 6,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                background: src.type === 'W-2' ? 'rgba(16,185,129,0.1)' : 'rgba(96,165,250,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ ...MONO, fontSize: 9, color: srcColor, fontWeight: 600, letterSpacing: '0.06em' }}>
                  {src.type}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{src.name}</div>
                <div style={{ ...MONO, fontSize: 11, color: '#5d6370' }}>
                  {src.rate ? `${fmtRate(src.rate)}/hr` : 'Variable'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...MONO, fontSize: 15, fontWeight: 600, color: '#e4e6ec' }}>
                  {fmt(srcTotal)}
                </div>
                <div style={{ ...MONO, fontSize: 10, color: '#5d6370', marginTop: 1 }}>this month</div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 20px 44px', textAlign: 'center' }}>
        <p style={{ ...MONO, fontSize: 10, color: '#2e3240', lineHeight: 1.7 }}>
          Planning tool, not legal advice.<br />
          Social Security makes the final determination.
        </p>
      </div>
    </div>
  );
}
