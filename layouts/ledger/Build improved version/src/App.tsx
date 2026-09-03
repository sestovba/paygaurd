import { useState, useMemo, useRef, useEffect } from 'react'
import {
  ShieldCheck, ChevronLeft, ChevronRight, Settings, Bell, Undo2,
  Briefcase, PieChart, CalendarDays, Plus, X, ChevronDown,
  TriangleAlert, Zap, Sparkles, Lock, LockOpen, Trash2, ArrowRight,
  TrendingUp
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_KEYS = Array.from({length:12},(_,i)=>`2026-${String(i+1).padStart(2,'0')}`)
const CURRENT_IDX = 8 // September
const CURRENT_KEY = '2026-09'
const SGA = 1210
const TWP_THRESHOLD = 1050
const YEAR = 2026

// ─── Types ────────────────────────────────────────────────────────────────────

type MonthData = { hours: number | null; gross: number | null }
type Job = {
  id: string
  name: string
  type: 'w2' | '1099'
  status: 'ongoing' | 'paused' | 'ended'
  since: string
  payCycle: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'
  anchorDate: string
  hourlyRate: number
  hoursPerWeek: number | null
  months: Record<string, MonthData>
}

// ─── Initial Data ─────────────────────────────────────────────────────────────

const initJobs: Job[] = [
  {
    id: 'riverside', name: 'Riverside Market', type: 'w2',
    status: 'ongoing', since: '2026-03', payCycle: 'biweekly',
    anchorDate: '2026-03-09', hourlyRate: 21.50, hoursPerWeek: null,
    months: {
      '2026-01':{hours:null,gross:null}, '2026-02':{hours:null,gross:null},
      '2026-03':{hours:null,gross:2000}, '2026-04':{hours:null,gross:1800},
      '2026-05':{hours:null,gross:2000}, '2026-06':{hours:null,gross:1800},
      '2026-07':{hours:null,gross:2000}, '2026-08':{hours:null,gross:1885},
      '2026-09':{hours:40, gross:860},
      '2026-10':{hours:null,gross:null}, '2026-11':{hours:null,gross:null}, '2026-12':{hours:null,gross:null},
    }
  },
  {
    id: 'delivery', name: 'Delivery driving', type: '1099',
    status: 'ongoing', since: '2026-02', payCycle: 'monthly',
    anchorDate: '2026-02-28', hourlyRate: 0, hoursPerWeek: null,
    months: {
      '2026-01':{hours:null,gross:null},
      '2026-02':{hours:null,gross:400}, '2026-03':{hours:null,gross:400},
      '2026-04':{hours:null,gross:500}, '2026-05':{hours:null,gross:450},
      '2026-06':{hours:null,gross:400}, '2026-07':{hours:null,gross:350},
      '2026-08':{hours:null,gross:503}, '2026-09':{hours:null,gross:157},
      '2026-10':{hours:null,gross:null}, '2026-11':{hours:null,gross:null}, '2026-12':{hours:null,gross:null},
    }
  }
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number, dec=0) => n.toLocaleString('en-US',{minimumFractionDigits:dec,maximumFractionDigits:dec})
const fmtMoney = (n: number) => `$${fmt(n)}`

function getMonthTotal(jobs: Job[], key: string) {
  return jobs.reduce((s,j) => s + (j.months[key]?.gross ?? 0), 0)
}
function getJobYTD(job: Job) {
  return MONTH_KEYS.reduce((s,k) => s + (job.months[k]?.gross ?? 0), 0)
}
function statusOf(total: number): 'empty'|'safe'|'warn'|'over' {
  if (!total) return 'empty'
  if (total < SGA * 0.85) return 'safe'
  if (total < SGA) return 'warn'
  return 'over'
}

// ─── Arc Gauge ────────────────────────────────────────────────────────────────

function ArcGauge({ pct, remaining, limit }: { pct: number; remaining: number; limit: number }) {
  const R = 82, cx = 110, cy = 110, sw = 11
  const toRad = (d: number) => (d * Math.PI) / 180
  const polar = (a: number) => ({ x: cx + R*Math.cos(toRad(a)), y: cy + R*Math.sin(toRad(a)) })
  const arc = (a1: number, a2: number, r: number) => {
    const s = polar(a1), e = polar(a2)
    const large = (a2 - a1) > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
  }
  const START = 215, TOTAL = 290
  const safe = pct < 0.85, over = pct >= 1
  const color = over ? '#f87171' : safe ? '#34d399' : '#fbbf24'
  const fillEnd = START + TOTAL * Math.min(pct, 1)

  return (
    <svg width="220" height="165" viewBox="0 0 220 165">
      <path d={arc(START, START+TOTAL, R)} fill="none" stroke="rgba(255,255,255,0.055)" strokeWidth={sw} strokeLinecap="round" />
      {pct > 0.005 && (
        <path d={arc(START, fillEnd, R)} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 10px ${color}80)` }} />
      )}
      <text x={cx} y={cy-8} textAnchor="middle" fill="white" fontSize="34" fontWeight="600"
        fontFamily="'DM Mono', monospace" letterSpacing="-1">
        {fmtMoney(remaining)}
      </text>
      <text x={cx} y={cy+14} textAnchor="middle" fill="rgba(255,255,255,0.38)" fontSize="11.5"
        fontFamily="'Outfit', sans-serif" fontWeight="500" letterSpacing="0.5">
        remaining this month
      </text>
      <text x={cx} y={cy+34} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="10.5"
        fontFamily="'DM Mono', monospace">
        of {fmtMoney(limit)} limit
      </text>
    </svg>
  )
}

// ─── TWP Pip ─────────────────────────────────────────────────────────────────

function TWPPips({ used, total, historical }: { used:number; total:number; historical:number }) {
  const pips = Array.from({length: total}, (_, i) => {
    if (i < historical) return 'historical'
    if (i < used) return 'used'
    if (i === used - 1 && used >= total) return 'last'
    return 'empty'
  })
  return (
    <div className="flex items-center gap-1">
      {pips.map((p, i) => (
        <div key={i} className="h-2 flex-1 rounded-full transition-all" style={{
          background: p === 'empty' ? 'rgba(255,255,255,0.08)'
            : p === 'historical' ? 'rgba(255,255,255,0.18)'
            : '#a78bfa',
          boxShadow: (p === 'used' || p === 'last') ? '0 0 6px rgba(167,139,250,0.5)' : 'none'
        }} />
      ))}
    </div>
  )
}

// ─── Year Bar Chart ───────────────────────────────────────────────────────────

function YearChart({ jobs }: { jobs: Job[] }) {
  const totals = MONTH_KEYS.map(k => getMonthTotal(jobs, k))
  const max = Math.max(...totals, SGA * 1.1)

  return (
    <div className="flex items-end gap-px" style={{height:88}}>
      {totals.map((total, i) => {
        const pct = total / max
        const s = statusOf(total)
        const isCurrent = i === CURRENT_IDX
        const color = s === 'empty' ? 'rgba(255,255,255,0.07)'
          : s === 'safe' ? '#34d399' : s === 'warn' ? '#fbbf24' : '#f87171'
        const sgaPct = SGA / max

        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="w-full relative flex items-end" style={{height:72}}>
              {/* SGA marker on current month */}
              {isCurrent && (
                <div className="absolute left-0 right-0 border-t border-dashed" style={{
                  bottom: `${sgaPct * 72}px`,
                  borderColor: 'rgba(251,191,36,0.4)'
                }} />
              )}
              <div className="w-full rounded-t-[2px] transition-all" style={{
                height: `${Math.max(pct * 72, total > 0 ? 4 : 0)}px`,
                background: color,
                opacity: isCurrent ? 1 : 0.65,
                boxShadow: total > 0 && isCurrent ? `0 0 8px ${color}60` : 'none'
              }} />
            </div>
            <span className="text-[9px] font-mono" style={{
              color: isCurrent ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
              fontFamily: "'DM Mono', monospace"
            }}>
              {MONTHS_SHORT[i]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Month Card (grid overview) ───────────────────────────────────────────────

function MonthCard({ monthIdx, jobs, isCurrent }: { monthIdx:number; jobs:Job[]; isCurrent:boolean }) {
  const key = MONTH_KEYS[monthIdx]
  const total = getMonthTotal(jobs, key)
  const s = statusOf(total)
  const isPast = monthIdx < CURRENT_IDX
  const isFuture = monthIdx > CURRENT_IDX
  const pct = Math.min(total / SGA, 1)

  const bgColor = isCurrent ? 'rgba(255,255,255,0.04)' : 'transparent'
  const dotColor = s === 'safe' ? '#34d399' : s === 'warn' ? '#fbbf24' : s === 'over' ? '#f87171' : 'rgba(255,255,255,0.12)'
  const barColor = s === 'safe' ? '#34d399' : s === 'warn' ? '#fbbf24' : s === 'over' ? '#f87171' : 'rgba(255,255,255,0.07)'

  return (
    <div className="rounded-lg p-3 border transition-all" style={{
      background: bgColor,
      borderColor: isCurrent ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
      opacity: isFuture ? 0.45 : 1
    }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{color:'rgba(255,255,255,0.55)'}}>
          {MONTHS_SHORT[monthIdx]}
        </span>
        <span className="w-1.5 h-1.5 rounded-full" style={{background: dotColor}} />
      </div>
      <div className="text-sm font-semibold mb-2" style={{
        fontFamily:"'DM Mono',monospace",
        color: total > 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.2)'
      }}>
        {total > 0 ? fmtMoney(total) : '—'}
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,0.06)'}}>
        <div className="h-full rounded-full transition-all" style={{width:`${pct*100}%`, background:barColor}} />
      </div>
    </div>
  )
}

// ─── Ledger Row ───────────────────────────────────────────────────────────────

function LedgerRow({
  monthIdx, job, onUpdate, isCurrent
}: {
  monthIdx: number
  job: Job
  onUpdate: (key: string, field: 'hours'|'gross', val: number|null) => void
  isCurrent: boolean
}) {
  const key = MONTH_KEYS[monthIdx]
  const data = job.months[key]
  const total = getMonthTotal([job], key)
  const isPast = monthIdx < CURRENT_IDX
  const isFuture = monthIdx > CURRENT_IDX
  const s = statusOf(total)
  const dotColor = s === 'safe' ? '#34d399' : s === 'warn' ? '#fbbf24' : s === 'over' ? '#f87171' : 'transparent'

  const parse = (v: string) => {
    const n = parseFloat(v.replace(/[^0-9.]/g,''))
    return isNaN(n) ? null : n
  }

  return (
    <div className="grid items-center border-b" style={{
      gridTemplateColumns:'80px 1fr 1fr 80px 36px',
      borderColor:'rgba(255,255,255,0.05)',
      background: isCurrent ? 'rgba(255,255,255,0.025)' : 'transparent',
      opacity: isFuture ? 0.4 : 1
    }}>
      <div className="px-3 py-2.5 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:dotColor}} />
        <span className="text-xs font-medium" style={{
          color: isCurrent ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.45)',
          fontFamily:"'DM Mono',monospace"
        }}>
          {MONTHS_SHORT[monthIdx]}
        </span>
      </div>
      {/* Hours */}
      <div className="border-l px-2 py-1.5" style={{borderColor:'rgba(255,255,255,0.05)'}}>
        {job.type === 'w2' ? (
          <input
            type="text" inputMode="decimal"
            defaultValue={data?.hours ?? ''}
            placeholder="—"
            onBlur={e => onUpdate(key, 'hours', parse(e.target.value))}
            className="w-full text-right text-xs"
            style={{fontFamily:"'DM Mono',monospace", color:'rgba(255,255,255,0.7)'}}
          />
        ) : (
          <span className="block text-right text-xs" style={{color:'rgba(255,255,255,0.2)'}}>—</span>
        )}
      </div>
      {/* Gross */}
      <div className="border-l px-2 py-1.5 flex items-center gap-1" style={{borderColor:'rgba(255,255,255,0.05)'}}>
        <span className="text-xs" style={{color:'rgba(255,255,255,0.25)'}}>$</span>
        <input
          type="text" inputMode="decimal"
          defaultValue={data?.gross ?? ''}
          placeholder="0"
          onBlur={e => onUpdate(key, 'gross', parse(e.target.value))}
          className="flex-1 text-right text-xs"
          style={{fontFamily:"'DM Mono',monospace", color:'rgba(255,255,255,0.8)'}}
        />
      </div>
      {/* Counted */}
      <div className="border-l px-3 py-2.5 text-right" style={{borderColor:'rgba(255,255,255,0.05)'}}>
        <span className="text-xs font-semibold" style={{
          fontFamily:"'DM Mono',monospace",
          color: total > 0 ? dotColor || 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)'
        }}>
          {total > 0 ? fmtMoney(total) : '—'}
        </span>
      </div>
      {/* Clear */}
      <div className="border-l flex items-center justify-center" style={{borderColor:'rgba(255,255,255,0.05)'}}>
        {(data?.gross != null || data?.hours != null) && (
          <button
            onClick={() => { onUpdate(key,'gross',null); onUpdate(key,'hours',null) }}
            className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            style={{color:'rgba(255,255,255,0.3)'}}
          >
            <X size={11} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [jobs, setJobs] = useState<Job[]>(initJobs)
  const [activeJob, setActiveJob] = useState('riverside')
  const [activeNav, setActiveNav] = useState<'months'|'limit'|'jobs'>('months')
  const [settingsOpen, setSettingsOpen] = useState(true)
  const [ledgerOpen, setLedgerOpen] = useState(true)

  const curJob = jobs.find(j => j.id === activeJob) ?? jobs[0]

  // Computed
  const monthTotal = useMemo(() => getMonthTotal(jobs, CURRENT_KEY), [jobs])
  const remaining = Math.max(SGA - monthTotal, 0)
  const pct = monthTotal / SGA

  const ytdByJob = useMemo(() => {
    const m: Record<string,number> = {}
    jobs.forEach(j => m[j.id] = getJobYTD(j))
    return m
  }, [jobs])

  // TWP months in 2026
  const twpMonths2026 = useMemo(() =>
    MONTH_KEYS.filter(k => getMonthTotal(jobs, k) >= TWP_THRESHOLD).length
  , [jobs])
  const twpHistorical = 2 // before tracker
  const twpUsed = twpHistorical + twpMonths2026
  const twpRemaining = 9 - twpUsed

  const updateMonth = (jobId: string, key: string, field: 'hours'|'gross', val: number|null) => {
    setJobs(prev => prev.map(j => j.id !== jobId ? j : {
      ...j, months: { ...j.months, [key]: { ...j.months[key], [field]: val } }
    }))
  }

  const statusColor = pct >= 1 ? '#f87171' : pct >= 0.85 ? '#fbbf24' : '#34d399'
  const statusLabel = pct >= 1 ? 'Over limit' : pct >= 0.85 ? 'Near limit' : 'Under limit'

  // Sections
  const monthsSection = (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-2xl border overflow-hidden" style={{borderColor:'rgba(255,255,255,0.07)', background:'#151518'}}>
        <div className="px-5 pt-5 pb-2 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{color:'rgba(255,255,255,0.3)'}}>September 2026</p>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{background:statusColor, boxShadow:`0 0 6px ${statusColor}80`}} />
              <span className="text-sm font-medium" style={{color:statusColor}}>{statusLabel}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{color:'rgba(255,255,255,0.3)'}}>SGA limit</p>
            <p className="text-sm font-semibold" style={{fontFamily:"'DM Mono',monospace"}}>{fmtMoney(SGA)}</p>
          </div>
        </div>

        <div className="flex flex-col items-center py-2">
          <ArcGauge pct={pct} remaining={remaining} limit={SGA} />
        </div>

        <div className="grid grid-cols-2 border-t" style={{borderColor:'rgba(255,255,255,0.06)'}}>
          <div className="px-4 py-3 border-r" style={{borderColor:'rgba(255,255,255,0.06)'}}>
            <p className="text-[11px] mb-0.5" style={{color:'rgba(255,255,255,0.3)'}}>Counted so far</p>
            <p className="text-base font-semibold" style={{fontFamily:"'DM Mono',monospace"}}>{fmtMoney(monthTotal)}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] mb-0.5" style={{color:'rgba(255,255,255,0.3)'}}>Headroom</p>
            <p className="text-base font-semibold" style={{fontFamily:"'DM Mono',monospace", color:statusColor}}>{fmtMoney(remaining)}</p>
          </div>
        </div>

        {/* Breakdown */}
        <div className="px-4 pb-4 pt-3 border-t" style={{borderColor:'rgba(255,255,255,0.06)'}}>
          <p className="text-[10px] uppercase tracking-wider mb-2" style={{color:'rgba(255,255,255,0.25)'}}>Breakdown</p>
          <div className="space-y-1.5">
            {jobs.map(j => {
              const gross = j.months[CURRENT_KEY]?.gross ?? 0
              return gross > 0 ? (
                <div key={j.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{
                      background: j.type === 'w2' ? 'rgba(129,140,248,0.15)' : 'rgba(167,139,250,0.15)',
                      color: j.type === 'w2' ? '#818cf8' : '#a78bfa'
                    }}>
                      {j.type === 'w2' ? 'W-2' : '1099'}
                    </span>
                    <span className="text-xs" style={{color:'rgba(255,255,255,0.5)'}}>{j.name}</span>
                  </div>
                  <span className="text-xs font-mono" style={{fontFamily:"'DM Mono',monospace", color:'rgba(255,255,255,0.6)'}}>
                    {fmtMoney(gross)}
                  </span>
                </div>
              ) : null
            })}
          </div>
        </div>
      </div>

      {/* TWP Tracker */}
      <div className="rounded-2xl border p-4" style={{borderColor:'rgba(255,255,255,0.07)', background:'#151518'}}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest mb-0.5" style={{color:'rgba(255,255,255,0.3)'}}>Trial Work Period</p>
            <p className="text-sm" style={{color:'rgba(255,255,255,0.6)'}}>
              <span className="font-semibold" style={{color:'#a78bfa', fontFamily:"'DM Mono',monospace"}}>{twpRemaining}</span>
              <span className="ml-1">of 9 months remaining</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{color:'rgba(255,255,255,0.25)'}}>threshold</p>
            <p className="text-xs font-mono" style={{fontFamily:"'DM Mono',monospace", color:'rgba(255,255,255,0.4)'}}>{fmtMoney(TWP_THRESHOLD)}/mo</p>
          </div>
        </div>
        <TWPPips used={twpUsed} total={9} historical={twpHistorical} />
        <div className="flex items-center gap-3 mt-2.5">
          <span className="flex items-center gap-1 text-[10px]" style={{color:'rgba(255,255,255,0.3)'}}>
            <span className="w-2 h-2 rounded-full" style={{background:'rgba(255,255,255,0.18)'}} />
            Before tracker
          </span>
          <span className="flex items-center gap-1 text-[10px]" style={{color:'rgba(255,255,255,0.3)'}}>
            <span className="w-2 h-2 rounded-full" style={{background:'#a78bfa'}} />
            Used
          </span>
          <span className="flex items-center gap-1 text-[10px]" style={{color:'rgba(255,255,255,0.3)'}}>
            <span className="w-2 h-2 rounded-full" style={{background:'rgba(255,255,255,0.08)'}} />
            Remaining
          </span>
        </div>
      </div>

      {/* Monthly grid */}
      <div className="rounded-2xl border p-4" style={{borderColor:'rgba(255,255,255,0.07)', background:'#151518'}}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium uppercase tracking-widest" style={{color:'rgba(255,255,255,0.3)'}}>All of {YEAR}</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px]" style={{color:'rgba(255,255,255,0.3)'}}>
              <span className="w-2 h-2 rounded-full" style={{background:'#34d399'}} />Safe
            </span>
            <span className="flex items-center gap-1 text-[10px]" style={{color:'rgba(255,255,255,0.3)'}}>
              <span className="w-2 h-2 rounded-full" style={{background:'#fbbf24'}} />Near
            </span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {Array.from({length:12},(_,i) => (
            <MonthCard key={i} monthIdx={i} jobs={jobs} isCurrent={i===CURRENT_IDX} />
          ))}
        </div>
        <div className="pt-3 border-t" style={{borderColor:'rgba(255,255,255,0.05)'}}>
          <p className="text-[10px] uppercase tracking-wider mb-2" style={{color:'rgba(255,255,255,0.25)'}}>
            Earnings vs SGA limit
          </p>
          <YearChart jobs={jobs} />
        </div>
      </div>
    </div>
  )

  const limitSection = (
    <div className="space-y-5">
      <div className="rounded-2xl border p-5" style={{borderColor:'rgba(255,255,255,0.07)', background:'#151518'}}>
        <p className="text-xs font-medium uppercase tracking-widest mb-4" style={{color:'rgba(255,255,255,0.3)'}}>
          Your 2026 SGA Limit
        </p>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-4xl font-bold" style={{fontFamily:"'DM Mono',monospace"}}>{fmtMoney(SGA)}</span>
          <span className="text-sm" style={{color:'rgba(255,255,255,0.4)'}}>per month</span>
        </div>
        <p className="text-sm mb-6" style={{color:'rgba(255,255,255,0.4)'}}>
          Substantial Gainful Activity threshold for non-blind beneficiaries in 2026.
        </p>
        <div className="space-y-3">
          {[
            { label: 'Months under limit', value: MONTH_KEYS.filter(k=>{ const t=getMonthTotal(jobs,k); return t>0 && t<SGA }).length, color:'#34d399' },
            { label: 'Months over limit', value: MONTH_KEYS.filter(k=>getMonthTotal(jobs,k)>=SGA).length, color:'#f87171' },
            { label: 'Trial work months used', value: twpUsed, color:'#a78bfa' },
            { label: 'Trial work months remaining', value: Math.max(9-twpUsed,0), color:'rgba(255,255,255,0.5)' },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-sm" style={{color:'rgba(255,255,255,0.5)'}}>{row.label}</span>
              <span className="text-sm font-semibold" style={{fontFamily:"'DM Mono',monospace", color:row.color}}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-5 p-3 rounded-xl text-xs leading-relaxed" style={{
          background:'rgba(167,139,250,0.07)',
          color:'rgba(255,255,255,0.4)',
          border:'1px solid rgba(167,139,250,0.15)'
        }}>
          These figures are for planning only. Confirm all thresholds with SSA before making work decisions.
        </div>
      </div>
    </div>
  )

  const jobsSection = (
    <div className="space-y-5">
      {/* Job tabs */}
      <div className="flex items-center gap-2">
        {jobs.map(j => {
          const ytd = ytdByJob[j.id] ?? 0
          const active = j.id === activeJob
          return (
            <button
              key={j.id}
              onClick={() => setActiveJob(j.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all border"
              style={{
                background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                borderColor: active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                color: active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)'
              }}
            >
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{
                background: j.type==='w2' ? 'rgba(129,140,248,0.15)' : 'rgba(167,139,250,0.15)',
                color: j.type==='w2' ? '#818cf8' : '#a78bfa'
              }}>
                {j.type==='w2' ? 'W-2' : '1099'}
              </span>
              <span className="hidden xs:inline">{j.name}</span>
              <span className="text-xs ml-1" style={{fontFamily:"'DM Mono',monospace", color:'rgba(255,255,255,0.3)'}}>
                {fmtMoney(ytd)}
              </span>
            </button>
          )
        })}
        <button
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all"
          style={{borderColor:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.4)'}}
        >
          <Plus size={13} /> Add job
        </button>
      </div>

      {/* Job panel */}
      <div className="rounded-2xl border overflow-hidden" style={{borderColor:'rgba(255,255,255,0.07)', background:'#151518'}}>
        {/* Job header */}
        <div className="px-5 py-4 border-b" style={{borderColor:'rgba(255,255,255,0.06)'}}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{
                background: curJob.type==='w2' ? 'rgba(129,140,248,0.15)' : 'rgba(167,139,250,0.15)',
                color: curJob.type==='w2' ? '#818cf8' : '#a78bfa'
              }}>
                {curJob.type==='w2' ? 'W-2' : '1099'}
              </span>
              <input
                className="text-base font-semibold bg-transparent border-b border-transparent hover:border-current focus:border-current transition-colors"
                style={{color:'rgba(255,255,255,0.85)', borderColor:'rgba(255,255,255,0.12)'}}
                defaultValue={curJob.name}
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px]" style={{color:'rgba(255,255,255,0.25)'}}>YTD</p>
                <p className="text-sm font-semibold" style={{fontFamily:"'DM Mono',monospace"}}>
                  {fmtMoney(ytdByJob[curJob.id] ?? 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Status seg */}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex rounded-lg overflow-hidden border" style={{borderColor:'rgba(255,255,255,0.08)'}}>
              {(['ongoing','paused','ended'] as const).map(s => (
                <button key={s} className="px-3 py-1 text-xs font-medium capitalize transition-all" style={{
                  background: curJob.status===s ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: curJob.status===s ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)'
                }}>
                  {s}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-xs" style={{color:'rgba(255,255,255,0.4)'}}>
              Since
              <input type="month" defaultValue={curJob.since} className="text-xs rounded-lg px-2 py-1 border" style={{
                background:'rgba(255,255,255,0.04)', borderColor:'rgba(255,255,255,0.08)',
                color:'rgba(255,255,255,0.6)'
              }} />
            </label>
          </div>
        </div>

        {/* Settings section */}
        <button
          onClick={() => setSettingsOpen(v => !v)}
          className="w-full flex items-center gap-2 px-5 py-3 border-b text-left transition-all"
          style={{borderColor:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.5)'}}
        >
          <ChevronDown size={14} className="transition-transform" style={{transform:settingsOpen?'rotate(0)':'rotate(-90deg)'}} />
          <span className="text-xs font-medium">Pay settings</span>
          <span className="ml-auto text-xs" style={{fontFamily:"'DM Mono',monospace", color:'rgba(255,255,255,0.25)'}}>
            {curJob.payCycle === 'biweekly' ? 'Every 2 weeks' : curJob.payCycle} · 26 checks
          </span>
        </button>

        {settingsOpen && (
          <div className="grid grid-cols-2 gap-px border-b" style={{borderColor:'rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.04)'}}>
            {[
              { label:'Pay cycle', content: (
                <select defaultValue="biweekly" className="w-full text-xs bg-transparent border-0 outline-none" style={{color:'rgba(255,255,255,0.7)'}}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every two weeks</option>
                  <option value="semimonthly">Twice a month</option>
                  <option value="monthly">Monthly</option>
                </select>
              )},
              { label:'Anchor payday', content: (
                <input type="date" defaultValue={curJob.anchorDate} className="text-xs" style={{color:'rgba(255,255,255,0.7)'}} />
              )},
              { label:'Planning rate', content: (
                <div className="flex items-center gap-1">
                  <span className="text-xs" style={{color:'rgba(255,255,255,0.3)'}}>$</span>
                  <input type="text" defaultValue={curJob.hourlyRate} className="flex-1 text-right text-xs" style={{fontFamily:"'DM Mono',monospace",color:'rgba(255,255,255,0.7)'}} />
                  <span className="text-[10px]" style={{color:'rgba(255,255,255,0.3)'}}>/hr</span>
                </div>
              )},
              { label:'Paychecks in 2026', content: (
                <span className="text-sm font-semibold" style={{fontFamily:"'DM Mono',monospace"}}>26</span>
              )},
            ].map(({ label, content }) => (
              <div key={label} className="p-3" style={{background:'#151518'}}>
                <p className="text-[10px] mb-2" style={{color:'rgba(255,255,255,0.3)'}}>{label}</p>
                {content}
              </div>
            ))}
          </div>
        )}

        {/* Ledger */}
        <button
          onClick={() => setLedgerOpen(v => !v)}
          className="w-full flex items-center gap-2 px-5 py-3 border-b text-left"
          style={{borderColor:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.5)'}}
        >
          <ChevronDown size={14} className="transition-transform" style={{transform:ledgerOpen?'rotate(0)':'rotate(-90deg)'}} />
          <span className="text-xs font-medium">{YEAR} monthly ledger</span>
          <span className="ml-auto text-xs" style={{color:'rgba(255,255,255,0.25)'}}>
            {MONTH_KEYS.filter(k => curJob.months[k]?.gross != null).length} of 12 months
          </span>
          <button
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium border ml-2"
            style={{
              background:'rgba(129,140,248,0.1)',
              borderColor:'rgba(129,140,248,0.2)',
              color:'#818cf8'
            }}
            onClick={e => e.stopPropagation()}
          >
            <Sparkles size={10} /> Autofill
          </button>
        </button>

        {ledgerOpen && (
          <div className="overflow-x-auto">
            {/* Table head */}
            <div className="grid sticky top-0 text-[10px] font-medium uppercase tracking-wider border-b" style={{
              gridTemplateColumns:'80px 1fr 1fr 80px 36px',
              borderColor:'rgba(255,255,255,0.06)',
              background:'#151518',
              color:'rgba(255,255,255,0.25)'
            }}>
              <div className="px-3 py-2">Month</div>
              <div className="px-3 py-2 text-right border-l" style={{borderColor:'rgba(255,255,255,0.05)'}}>Hours</div>
              <div className="px-3 py-2 text-right border-l" style={{borderColor:'rgba(255,255,255,0.05)'}}>Gross</div>
              <div className="px-3 py-2 text-right border-l" style={{borderColor:'rgba(255,255,255,0.05)'}}>Counted</div>
              <div className="px-3 py-2 text-center border-l" style={{borderColor:'rgba(255,255,255,0.05)'}}>—</div>
            </div>
            <div className="group">
              {Array.from({length:12},(_,i) => (
                <LedgerRow
                  key={i}
                  monthIdx={i}
                  job={curJob}
                  isCurrent={i===CURRENT_IDX}
                  onUpdate={(k,f,v) => updateMonth(curJob.id,k,f,v)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="px-5 py-3 text-xs leading-relaxed" style={{color:'rgba(255,255,255,0.25)'}}>
          These figures are for planning. Confirm with Social Security before acting on them.
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh flex flex-col" style={{background:'#0c0c0f', fontFamily:"'Outfit', sans-serif"}}>
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 px-4 h-14 border-b" style={{
        background:'rgba(12,12,15,0.9)',
        borderColor:'rgba(255,255,255,0.06)',
        backdropFilter:'blur(12px)'
      }}>
        {/* Brand */}
        <div className="flex items-center gap-2.5 mr-2">
          <div className="grid place-items-center w-7 h-7 rounded-lg" style={{
            background:'linear-gradient(135deg,#818cf8,#a78bfa)',
            boxShadow:'0 2px 8px rgba(129,140,248,0.35)'
          }}>
            <ShieldCheck size={14} color="white" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-none" style={{letterSpacing:'-0.01em'}}>PayGuard</p>
            <p className="text-[10px] leading-none mt-0.5" style={{color:'rgba(255,255,255,0.3)'}}>SSDI income planner</p>
          </div>
        </div>

        {/* Year stepper */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg border" style={{borderColor:'rgba(255,255,255,0.07)'}}>
          <button className="p-1 rounded hover:bg-white/5 transition-colors" style={{color:'rgba(255,255,255,0.4)'}}>
            <ChevronLeft size={12} />
          </button>
          <span className="text-xs font-semibold px-1" style={{fontFamily:"'DM Mono',monospace"}}>{YEAR}</span>
          <button className="p-1 rounded opacity-30" disabled style={{color:'rgba(255,255,255,0.4)'}}>
            <ChevronRight size={12} />
          </button>
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button className="relative p-2 rounded-lg border transition-all hover:bg-white/5" style={{
            borderColor:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.5)'
          }}>
            <Bell size={14} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{background:'#fbbf24'}} />
          </button>
          <button className="p-2 rounded-lg border transition-all hover:bg-white/5 opacity-40" disabled style={{
            borderColor:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.5)'
          }}>
            <Undo2 size={14} />
          </button>
          <button className="p-2 rounded-lg border transition-all hover:bg-white/5" style={{
            borderColor:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.5)'
          }}>
            <Settings size={14} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-5 pb-24">
        {activeNav === 'months' && monthsSection}
        {activeNav === 'limit' && limitSection}
        {activeNav === 'jobs' && jobsSection}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 flex border-t" style={{
        background:'rgba(12,12,15,0.95)',
        borderColor:'rgba(255,255,255,0.06)',
        backdropFilter:'blur(12px)'
      }}>
        {([
          { id:'months', label:'Months', icon: CalendarDays },
          { id:'limit', label:'Your limit', icon: PieChart },
          { id:'jobs', label:'Jobs', icon: Briefcase },
        ] as const).map(({ id, label, icon: Icon }) => {
          const active = activeNav === id
          return (
            <button
              key={id}
              onClick={() => setActiveNav(id)}
              className="flex-1 flex flex-col items-center gap-1 py-3 transition-all relative"
              style={{
                color: active ? '#818cf8' : 'rgba(255,255,255,0.3)',
              }}
            >
              <Icon size={18} />
              <span className="text-[10px] font-medium">{label}</span>
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-px" style={{
                  background:'linear-gradient(90deg,transparent,#818cf8,transparent)'
                }} />
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
