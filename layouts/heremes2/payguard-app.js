// ── STATE ──
const SGA_TRIAL       = 1210;
const SGA_SUBSTANTIAL = 1690;
const TWP_TOTAL       = 9;
const STORAGE_KEY     = 'payguard_state_v3';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const BAR_COMMA       = '\u2014'; // em dash
const BAR_CHECK       = '\u2713'; // check
const BAR_PLUS        = '\u2212'; // minus
const BAR_EMPTY       = '\u00A0'; // non-breaking space

const STATUS_TEXT = { ongoing: 'Working', paused: 'Paused', ended: 'Ended' };

let state = loadState();
let expandedJobId = null;   // which job edit panel is open
let flashJobId = null;      // job card to flash on edit
let activeModal = null;     // { type, data?, resolve? }

// ── HELPERS ──
function $(sel, root) { return (root || document).querySelector(sel); }
function el(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'className') e.className = attrs[k];
    else if (k === 'onClick') e.addEventListener('click', attrs[k]);
    else if (k === 'onChange') e.addEventListener('change', attrs[k]);
    else if (k === 'onInput') e.addEventListener('input', attrs[k]);
    else if (k === 'onKeyDown') e.addEventListener('keydown', attrs[k]);
    else if (k === 'text') e.textContent = attrs[k];
    else if (k === 'style') {
      for (const sk in attrs[k]) {
        e.style.setProperty(sk, attrs[k][sk]);
      }
    }
    else if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
  }
  if (children) {
    if (typeof children === 'string') e.textContent = children;
    else if (Array.isArray(children)) children.forEach(c => e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    else e.appendChild(children);
  }
  return e;
}
function fmt(n) { const v = Number(n) || 0; return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fmtMoney(n) { const v = Number(n) || 0; return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function min(a, b) { return Math.min(a, b); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function parseDate(s) { const [y, m] = s.split('-').map(Number); return { year: y, month: m - 1 }; }
function dateKey(y, m) { return y + '-' + String(m + 1).padStart(2, '0'); }
function todayMonth() { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; }
function isCurrentMonth(y, m) { const t = todayMonth(); return y === t.year && m === t.month; }
function monthIndex(y, m) { // 0-23 relative to year 2026 baseline
  return (y - 2026) * 12 + m;
}
function fromMonthIndex(i) {
  return { year: 2026 + Math.floor(i / 12), month: i % 12 };
}

// ── STORAGE ──
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s === 'object') {
        if (!Array.isArray(s.jobs)) s.jobs = [];
        if (!Array.isArray(s.entries)) s.entries = [];
        if (typeof s.cycle !== 'string') s.cycle = 'monthly';
        if (typeof s.anchorDay !== 'number') s.anchorDay = 15;
        if (typeof s.planningRate !== 'number') s.planningRate = SGA_TRIAL;
        if (typeof s.paychecks !== 'number') s.paychecks = 1;
        return s;
      }
    }
  } catch (e) { /* ignore corrupt */ }
  return defaultState();
}
function defaultState() {
  return {
    jobs: [],
    entries: [],
    cycle: 'monthly',
    anchorDay: 15,
    planningRate: SGA_TRIAL,
    paychecks: 1
  };
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

// ── TOAST ──
const toastEl = $('#toast');
function showToast(msg, type) {
  toastEl.textContent = msg;
  toastEl.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toastEl.className = 'toast'; }, 2500);
}

// ── MODAL SYSTEM ──
const modalOverlay = el('div', { className: 'modal-overlay', id: 'modal-overlay' });
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay && activeModal) closeModal();
});
document.body.appendChild(modalOverlay);

function openModal(title, bodyEl, footerEl) {
  activeModal = { title, bodyEl, footerEl };
  modalOverlay.innerHTML = '';
  modalOverlay.className = 'modal-overlay open';
  const m = el('div', { className: 'modal' });
  if (title) m.appendChild(el('div', { className: 'modal-header' }, [
    el('span', { className: 'modal-title', text: title }),
    el('button', { className: 'modal-close', 'aria-label': 'Close', onClick: closeModal }, [
      el('svg', { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
        el('path', { d: 'M18 6 6 18M6 6l12 12' })
      ])
    ])
  ]));
  if (bodyEl) m.appendChild(el('div', { className: 'modal-body' }, [bodyEl]));
  if (footerEl) m.appendChild(el('div', { className: 'modal-footer' }, [footerEl]));
  modalOverlay.appendChild(m);
  // Focus first input
  setTimeout(() => { const i = m.querySelector('input, select, button'); if (i) i.focus(); }, 50);
}
function closeModal() {
  activeModal = null;
  modalOverlay.className = 'modal-overlay';
  modalOverlay.innerHTML = '';
}

// ── CONFIRM DIALOG ──
function confirmDialog(question, onConfirm) {
  const body = el('div', { className: 'form-row' }, [
    el('p', { style: { color: 'var(--text-2)', marginBottom: 8 }, text: question })
  ]);
  const footer = el('div', { className: 'modal-footer' }, [
    el('button', { className: 'btn btn-ghost', text: 'Cancel', onClick: closeModal }),
    el('button', { className: 'btn btn-danger', text: 'Delete', onClick: () => { closeModal(); onConfirm(); } })
  ]);
  openModal('Confirm', body, footer);
}

// ── MONTH PICKER (reusable) ──
function monthPicker(options) {
  const { value, onChange, label, includeFuture } = options;
  const current = todayMonth();
  const startY = 2025, endY = 2035;
  const months = [];
  for (let y = startY; y <= endY; y++) {
    const maxM = (y === current.year && !includeFuture) ? current.month : 11;
    for (let m = 0; m <= maxM; m++) months.push({ year: y, month: m, label: MONTHS_SHORT[m] + ' ' + y });
  }
  const select = el('select', {
    className: 'modal-input',
    onChange: (e) => onChange(parseDate(e.target.value))
  });
  select.appendChild(el('option', { value: '', text: 'Select month...' }));
  months.forEach(mo => {
    const y = mo.year, m = mo.month;
    select.appendChild(el('option', {
      value: dateKey(y, m),
      text: mo.label,
      selected: y === value.year && m === value.month
    }));
  });
  return el('div', { className: 'form-row' }, [
    el('label', { className: 'modal-label', text: label || 'Month' }),
    select
  ]);
}

// ── EDITOR ROW HELPER ──
function editorRow(label, input) {
  return el('div', { className: 'form-row' }, [
    el('label', { className: 'modal-label', text: label }),
    input
  ]);
}
function textInput(value, opts) {
  const { placeholder, mono, required, id } = opts || {};
  return el('input', {
    type: 'text',
    className: 'modal-input' + (mono ? ' mono' : ''),
    placeholder: placeholder || '',
    value: value || '',
    required: !!required,
    id: id
  });
}
function moneyInput(value, opts) {
  return textInput(value, Object.assign({ mono: true, placeholder: '$0.00' }, opts || {}));
}
function numInput(value, opts) {
  return el('input', {
    type: 'number',
    className: 'modal-input mono',
    value: value !== undefined ? value : '',
    placeholder: opts && opts.placeholder || '',
    min: opts && opts.min,
    max: opts && opts.max,
    step: opts && opts.step || 'any'
  });
}
function selectInput(options, value, onChange, label) {
  const sel = el('select', { className: 'modal-input', onChange });
  sel.appendChild(el('option', { value: '', text: '-- select --' }));
  options.forEach(([v, t]) => sel.appendChild(el('option', { value: v, text: t, selected: String(v) === String(value) })));
  return el('div', { className: 'form-row' }, [
    label ? el('label', { className: 'modal-label', text: label }) : null,
    sel
  ].filter(Boolean));
}
function dateInput(value, label) {
  const y = value ? value.year : '';
  const m = value ? String(value.month + 1).padStart(2, '0') : '';
  return editorRow(label || 'Date', el('input', {
    type: 'month',
    className: 'modal-input',
    value: y + '-' + m,
    onChange: (e) => {
      const [yy, mm] = e.target.value.split('-');
      return { year: parseInt(yy, 10), month: parseInt(mm, 10) - 1 };
    }
  }));
}
// ── SVG GAUGE RING ──
function gaugeRingSVG(pct, color) {
  const r = 50, cx = 56, cy = 56;
  const circ = 2 * Math.PI * r;
  const dash = clamp(pct, 0, 1) * circ;
  const shift = -Math.PI / 2;
  // start at top (-90deg), go clockwise
  const x0 = cx + r * Math.cos(shift), y0 = cy + r * Math.sin(shift);
  const x1 = cx + r * Math.cos(shift + dash / r), y1 = cy + r * Math.sin(shift + dash / r);
  const large = dash > circ / 2 ? 1 : 0;
  const sweep = 1; // clockwise
  const d = `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
  return `<svg class="gauge-svg" viewBox="0 0 112 112">
    <circle class="gauge-track" cx="${cx}" cy="${cy}" r="${r}" />
    <path class="gauge-fill" d="${d}" fill="none" stroke="${color || 'var(--safe)'}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${dash} ${circ}" stroke-dashoffset="0" />
    <circle cx="${cx}" cy="${cy}" r="32" fill="var(--surface-2)" stroke="var(--border)" stroke-width="1" />
  </svg>`;
}

// ── COUNTED AMOUNT ──
function countedAmount(job, entry) {
  const gross = Number(entry.amount) || 0;
  if (job.type === 'W-2') {
    // W-2 counts in full
    return gross;
  } else if (job.type === '1099') {
    // 1099: deduct mileage reimbursement & disability work expenses if provided
    const deductions = Number(entry.deductions) || 0;
    return Math.max(0, gross - deductions);
  } else {
    // gig: same as 1099
    const deductions = Number(entry.deductions) || 0;
    return Math.max(0, gross - deductions);
  }
}

// ── JOB CRUD ──
function addJob(data) {
  const job = {
    id: data.id || uid(),
    name: data.name || 'New Job',
    type: data.type || 'W-2',
    rate: data.rate !== undefined ? Number(data.rate) || 0 : 0,
    cycle: data.cycle || 'monthly',
    anchorDay: data.anchorDay !== undefined ? Number(data.anchorDay) || 15 : 15,
    planningRate: data.planningRate !== undefined ? Number(data.planningRate) || SGA_TRIAL : SGA_TRIAL,
    paychecks: data.paychecks !== undefined ? Number(data.paychecks) || 1 : 1,
    status: data.status || 'ongoing',
    startDate: data.startDate || dateKey(todayMonth().year, todayMonth().month),
    payDate: data.payDate || null,
    ytdCounted: 0
  };
  // Derive payDate from cycle + anchorDay
  job.payDate = derivePayDate(job);
  state.jobs.unshift(job);
  saveState();
  render();
  showToast('Job "' + job.name + '" added', 'success');
}

function editJob(id, data) {
  const idx = state.jobs.findIndex(j => j.id === id);
  if (idx < 0) return;
  const job = state.jobs[idx];
  if (data.name !== undefined) job.name = data.name || 'Unnamed Job';
  if (data.type !== undefined) job.type = data.type;
  if (data.rate !== undefined) job.rate = Number(data.rate) || 0;
  if (data.cycle !== undefined) job.cycle = data.cycle;
  if (data.anchorDay !== undefined) job.anchorDay = Number(data.anchorDay) || 15;
  if (data.planningRate !== undefined) job.planningRate = Number(data.planningRate) || SGA_TRIAL;
  if (data.paychecks !== undefined) job.paychecks = Number(data.paychecks) || 1;
  if (data.status !== undefined) job.status = data.status;
  if (data.startDate !== undefined) job.startDate = data.startDate;
  job.payDate = derivePayDate(job);
  flashJobId = id;
  saveState();
  render();
  showToast('Job updated', 'success');
}

function deleteJob(id) {
  const job = state.jobs.find(j => j.id === id);
  if (!job) return;
  confirmDialog('Delete job "' + job.name + '" and all its entries?', () => {
    state.jobs = state.jobs.filter(j => j.id !== id);
    state.entries = state.entries.filter(e => e.jobId !== id);
    if (expandedJobId === id) expandedJobId = null;
    saveState();
    render();
    showToast('Job deleted', 'success');
  });
}

function setJobStatus(id, status) {
  const job = state.jobs.find(j => j.id === id);
  if (!job) return;
  job.status = status;
  saveState();
  render();
}

function derivePayDate(job) {
  // Derive approximate pay date from cycle + anchor day
  if (!job.cycle) return '';
  const d = new Date();
  switch (job.cycle) {
    case 'weekly':
      d.setDate(job.anchorDay || 15);
      break;
    case 'biweekly':
      d.setDate(job.anchorDay || 15);
      break;
    case 'semimonthly':
      d.setDate(Math.min(job.anchorDay || 15, 28));
      break;
    case 'monthly':
    default:
      d.setDate(Math.min(job.anchorDay || 15, 28));
      break;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

// ── COMPUTE JOB TOTALS ──
function jobYTD(job) {
  return state.entries
    .filter(e => e.jobId === job.id && e.year <= todayMonth().year)
    .reduce((s, e) => s + countedAmount(job, e), 0);
}

function jobMonthTotal(job, year, month) {
  return state.entries
    .filter(e => e.jobId === job.id && e.year === year && e.month === month)
    .reduce((s, e) => s + countedAmount(job, e), 0);
}

function jobMonthlyIncome(job, year) {
  const totals = [];
  for (let m = 0; m < 12; m++) totals.push(jobMonthTotal(job, year, m));
  return totals;
}

function jobYearTotal(job, year) {
  return jobMonthlyIncome(job, year).reduce((s, v) => s + v, 0);
}
// ── ENTRY CRUD ──
function addEntry(jobId, data) {
  const job = state.jobs.find(j => j.id === jobId);
  if (!job) return;
  const entry = {
    id: uid(),
    jobId: jobId,
    amount: Number(data.amount) || 0,
    hours: Number(data.hours) || 0,
    deductions: Number(data.deductions) || 0,
    notes: data.notes || '',
    payDate: data.payDate || null,
    year: data.payDate ? parseDate(data.payDate).year : todayMonth().year,
    month: data.payDate ? parseDate(data.payDate).month : todayMonth().month,
    createdAt: Date.now()
  };
  // If payDate string provided, parse year/month from it
  if (data.payDate) {
    const d = parseDate(data.payDate);
    entry.year = d.year;
    entry.month = d.month;
  } else if (data.year !== undefined) {
    entry.year = data.year;
    entry.month = data.month;
  }
  state.entries.push(entry);
  saveState();
  render();
  showToast('Entry added to "' + job.name + '"', 'success');
}

function editEntry(id, data) {
  const idx = state.entries.findIndex(e => e.id === id);
  if (idx < 0) return;
  const entry = state.entries[idx];
  if (data.amount !== undefined) entry.amount = Number(data.amount) || 0;
  if (data.hours !== undefined) entry.hours = Number(data.hours) || 0;
  if (data.deductions !== undefined) entry.deductions = Number(data.deductions) || 0;
  if (data.notes !== undefined) entry.notes = data.notes || '';
  if (data.payDate !== undefined) {
    const d = parseDate(data.payDate);
    entry.year = d.year;
    entry.month = d.month;
  }
  // Recompute year/month from payDate if provided
  if (data.payDate) {
    const d = parseDate(data.payDate);
    entry.year = d.year;
    entry.month = d.month;
  } else if (data.year !== undefined) {
    entry.year = data.year;
    entry.month = data.month;
  }
  saveState();
  render();
  showToast('Entry updated', 'success');
}

function deleteEntry(id) {
  const entry = state.entries.find(e => e.id === id);
  if (!entry) return;
  const job = state.jobs.find(j => j.id === entry.jobId);
  const jobName = job ? job.name : 'unknown';
  confirmDialog('Delete this entry from "' + jobName + '"?', () => {
    state.entries = state.entries.filter(e => e.id !== id);
    saveState();
    render();
    showToast('Entry deleted', 'success');
  });
}

// ── ENTRY MODAL (add) ──
function openAddEntryModal(jobId) {
  const job = state.jobs.find(j => j.id === jobId);
  if (!job) return;
  const payDate = dateKey(todayMonth().year, todayMonth().month);
  const fields = [
    datePicker({ value: payDate, onChange: () => {}, label: 'Pay Date' }),
    moneyInput('', { label: 'Gross Amount ($)' }),
    numInput('', { label: 'Hours Worked', placeholder: 'Optional' }),
    moneyInput('', { label: 'Deductions ($)', hint: 'Mileage, disability work costs...' }),
    textInput('', { label: 'Notes', placeholder: 'Optional note...' })
  ];
  const footer = el('div', { className: 'modal-footer' }, [
    el('button', { className: 'btn btn-ghost', text: 'Cancel', onClick: closeModal }),
    el('button', { className: 'btn btn-primary', text: 'Add Entry', onClick: () => {
      const form = footer.previousElementSibling;
      const amount = parseFloat(form.querySelector('input[type="text"].mono')?.value) || 0;
      const hours = parseFloat(form.querySelectorAll('input[type="number"]')[0]?.value) || 0;
      const deductions = parseFloat(form.querySelectorAll('input[type="text"].mono')[1]?.value) || 0;
      const notes = form.querySelector('input[type="text"]:not(.mono)')?.value || '';
      const payDateVal = form.querySelector('select')?.value || payDate;
      if (!amount && !hours && !deductions && !notes) {
        showToast('Enter at least an amount or hours', 'error');
        return;
      }
      addEntry(jobId, { amount, hours, deductions, notes, payDate: payDateVal });
      closeModal();
    }})
  ]);
  openModal('Log Pay — ' + job.name, el('div', {}, fields), footer);
}

// ── ENTRY MODAL (edit) ──
function openEditEntryModal(entryId) {
  const entry = state.entries.find(e => e.id === entryId);
  if (!entry) return;
  const job = state.jobs.find(j => j.id === entry.jobId);
  if (!job) return;
  const payDateStr = entry.payDate || dateKey(entry.year, entry.month);
  const fields = [
    datePicker({ value: payDateStr, label: 'Pay Date' }),
    moneyInput(String(entry.amount || 0), { label: 'Gross Amount ($)' }),
    numInput(String(entry.hours || 0), { label: 'Hours Worked' }),
    moneyInput(String(entry.deductions || 0), { label: 'Deductions ($)', hint: 'Mileage, disability work costs...' }),
    textInput(entry.notes || '', { label: 'Notes', placeholder: 'Optional note...' })
  ];
  const footer = el('div', { className: 'modal-footer' }, [
    el('button', { className: 'btn btn-ghost', text: 'Cancel', onClick: closeModal }),
    el('button', { className: 'btn btn-danger', text: 'Delete', onClick: () => {
      closeModal();
      deleteEntry(entryId);
    }}),
    el('button', { className: 'btn btn-primary', text: 'Save', onClick: () => {
      const form = footer.previousElementSibling;
      const amount = parseFloat(form.querySelectorAll('input[type="text"].mono')[0]?.value) || 0;
      const hours = parseFloat(form.querySelectorAll('input[type="number"]')[0]?.value) || 0;
      const deductions = parseFloat(form.querySelectorAll('input[type="text"].mono')[1]?.value) || 0;
      const notes = form.querySelector('input[type="text"]:not(.mono)')?.value || '';
      const payDateVal = form.querySelector('select')?.value || payDateStr;
      editEntry(entryId, { amount, hours, deductions, notes, payDate: payDateVal });
      closeModal();
    }})
  ]);
  openModal('Edit Entry — ' + (job ? job.name : 'Job'), el('div', {}, fields), footer);
}

// ── DATE PICKER HELPERS ──
function datePicker({ value, onChange, label }) {
  const parts = value ? value.split('-') : [];
  const y = parts[0] || String(todayMonth().year);
  const m = parts[1] || String(todayMonth().month + 1).padStart(2, '0');
  const input = el('input', {
    type: 'month',
    className: 'modal-input',
    value: y + '-' + m,
    onChange: (e) => {
      const [yy, mm] = e.target.value.split('-');
      const v = { year: parseInt(yy, 10), month: parseInt(mm, 10) - 1 };
      if (onChange) onChange(v);
      return v;
    }
  });
  return el('div', { className: 'form-row' }, [
    label ? el('label', { className: 'modal-label', text: label }) : null,
    input
  ].filter(Boolean));
}

// Re-export helpers we need in chunk 4
window.__pg_helpers = {
  $: $,
  el: el,
  fmt: fmt,
  fmtMoney: fmtMoney,
  uid: uid,
  parseDate: parseDate,
  dateKey: dateKey,
  todayMonth: todayMonth,
  isCurrentMonth: isCurrentMonth,
  monthIndex: monthIndex,
  fromMonthIndex: fromMonthIndex,
  clamp: clamp,
  showToast: showToast,
  openModal: openModal,
  closeModal: closeModal,
  confirmDialog: confirmDialog,
  state: state,
  MONTHS_SHORT: MONTHS_SHORT,
  MONTHS_FULL: MONTHS_FULL,
  SGA_TRIAL: SGA_TRIAL,
  SGA_SUBSTANTIAL: SGA_SUBSTANTIAL,
  TWP_TOTAL: TWP_TOTAL,
  STORAGE_KEY: STORAGE_KEY,
  STATUS_TEXT: STATUS_TEXT,
  addEntry: addEntry,
  editEntry: editEntry,
  deleteEntry: deleteEntry,
  openAddEntryModal: openAddEntryModal,
  openEditEntryModal: openEditEntryModal,
  jobYTD: jobYTD,
  jobMonthTotal: jobMonthTotal,
  jobMonthlyIncome: jobMonthlyIncome,
  jobYearTotal: jobYearTotal,
  countedAmount: countedAmount,
  gaugeRingSVG: gaugeRingSVG,
  addJob: addJob,
  editJob: editJob,
  deleteJob: deleteJob,
  setJobStatus: setJobStatus,
  derivePayDate: derivePayDate,
  saveState: saveState,
  loadState: loadState
};
// ── RENDER ──
function render() {
  const root = $('#root');
  root.innerHTML = '';

  const appShell = el('div', { className: 'app-shell' });

  // ── HEADER ──
  const header = el('header');
  const headerInner = el('div', { className: 'header-inner' });
  headerInner.appendChild(el('div', { className: 'brand' }, [
    el('div', { className: 'brand-icon' }, [
      el('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'white', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
        el('path', { d: 'M12 2v20M17 7H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' })
      ])
    ]),
    el('span', { text: 'PayGuard' }),
    el('span', { className: 'brand-year', text: todayMonth().year.toString() })
  ]));
  const headerActions = el('div', { className: 'header-actions' });
  headerActions.appendChild(el('button', { className: 'icon-btn', 'aria-label': 'Settings', title: 'Settings' }, [
    el('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      el('circle', { cx: 12, cy: 12, r: 3 }),
      el('path', { d: 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42' })
    ])
  ]));
  headerActions.appendChild(el('button', { className: 'icon-btn', 'aria-label': 'Notifications', title: 'Notifications' }, [
    el('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      el('path', { d: 'M18 8A6 6 0 0 0 6 8c4 0 6 4 6 4v1c0 1.1-.9 2-2 2h-3c-1.1 0-2-.9-2-2V8.75C4 7.5 4 7 4 6c0-2 2-3.5 4-3.5s4 1.5 4 3.5c0 1.5-1 2.75-2 3.75V18c0 1.1-.9 2-2 2h-2c-1.1 0-2-.9-2-2v-1.25c-1-.5-1.75-1.25-2-2.25C3 12.5 3 11 3 9.5 3 7 5 5 7 5s4 2.5 4 5c0 1.5 1 2.75 2 3.75V20c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-1.25c1-.5 1.75-1.25 2-2.25C14 12.5 14 11 14 9.5 14 7 16 5 18 5s4 2.5 4 5' }),
      el('path', { d: 'M13.73 21a2 2 0 0 1-3.46 0' })
    ]),
    el('span', { className: 'badge' })
  ]));
  headerInner.appendChild(headerActions);
  header.appendChild(headerInner);
  appShell.appendChild(header);

  // ── SGA GAUGE SECTION ──
  const ytdTotal = state.jobs.reduce((s, j) => s + jobYTD(j), 0);
  const pct = clamp(ytdTotal / SGA_TRIAL, 0, 1);
  const gaugeColor = pct >= 1 ? 'var(--careful)' : (pct > 0.85 ? 'var(--careful)' : 'var(--safe)');
  const gaugeStatus = pct >= 1 ? 'over' : (pct > 0.85 ? 'careful' : 'safe');

  const gaugeSection = el('section', { className: 'gauge-section' });
  const gaugeWrap = el('div', { className: 'gauge-wrap' });
  // Gauge dial
  const gaugeDial = el('div', { className: 'gauge-dial' });
  gaugeDial.innerHTML = gaugeRingSVG(pct, gaugeColor);
  const gaugeCenter = el('div', { className: 'gauge-center' });
  gaugeCenter.appendChild(el('span', {
    className: 'gauge-amount ' + gaugeStatus,
    text: fmtMoney(ytdTotal)
  }));
  gaugeCenter.appendChild(el('span', { className: 'gauge-label', text: 'YTD' }));
  gaugeDial.appendChild(gaugeCenter);
  gaugeWrap.appendChild(gaugeDial);
  // Note
  const gaugeNote = el('div', { className: 'gauge-note' });
  gaugeNote.innerHTML = `<strong> SGA trial work period </strong> $${SGA_TRIAL}/month<br>Counts each W-2 job in full; 1099/gig counts gross minus deductions.`;
  gaugeWrap.appendChild(gaugeNote);
  gaugeSection.appendChild(gaugeWrap);
  // Footer stats
  const gaugeFooter = el('div', { className: 'gauge-footer' });
  const gaugeStats = [
    { label: 'Active jobs', value: String(state.jobs.filter(j => j.status === 'ongoing').length) },
    { label: 'YTD entries', value: String(state.entries.length) },
    { label: 'Limit', value: '$' + SGA_TRIAL }
  ];
  gaugeStats.forEach(({ label, value }) => {
    const stat = el('div', { className: 'gauge-stat' });
    stat.appendChild(el('div', { className: 'gauge-stat-label', text: label }));
    stat.appendChild(el('div', { className: 'gauge-stat-value', text: value }));
    gaugeFooter.appendChild(stat);
  });
  // TWP mini
  const twpCount = countTwpUsed();
  const twpStat = el('div', { className: 'gauge-stat' });
  twpStat.appendChild(el('div', { className: 'gauge-stat-label', text: 'TWP used' }));
  twpStat.appendChild(el('div', { className: 'gauge-stat-value brand', text: twpCount + ' / ' + TWP_TOTAL }));
  gaugeFooter.appendChild(twpStat);
  gaugeSection.appendChild(gaugeFooter);
  appShell.appendChild(gaugeSection);

  // ── TWP TRACKER ──
  const twpSection = el('section');
  const sectionHead = el('div', { className: 'section-head' });
  sectionHead.appendChild(el('span', { className: 'section-label', text: 'Trial Work Period' }));
  sectionHead.appendChild(el('button', { className: 'btn btn-ghost btn-sm', text: 'How it works', 'aria-label': 'TWP info' }));
  twpSection.appendChild(sectionHead);
  const twpDots = el('div', { className: 'twp-dots' });
  for (let i = 0; i < TWP_TOTAL; i++) {
    const dot = el('div', {
      className: 'twp-dot ' + twpDotClass(i),
      title: 'Service month ' + (i + 1)
    });
    twpDots.appendChild(dot);
  }
  twpSection.appendChild(twpDots);
  const twpInfo = el('div', { className: 'twp-info' });
  twpInfo.innerHTML = `<strong>${twpCount} of ${TWP_TOTAL} service months used.</strong><br>
    Once you complete 9 service months, SSA reviews your earnings — earnings above <strong>$${SGA_SUBSTANTIAL}/mo</strong> may affect SSDI.`;
  twpSection.appendChild(twpInfo);
  appShell.appendChild(twpSection);

  // ── JOBS SECTION ──
  const jobsSection = el('section');
  const jobsHead = el('div', { className: 'section-head' });
  const jobsLabel = el('span', { className: 'section-label' }, [
    el('span', { className: 'dot' }),
    el('span', { text: 'Your Income Sources' })
  ]);
  jobsHead.appendChild(jobsLabel);
  const addJobBtn = el('button', {
    className: 'btn btn-primary btn-sm',
    text: '+ Add Job',
    onClick: () => openAddJobModal()
  });
  jobsHead.appendChild(addJobBtn);
  if (state.jobs.length > 0) {
    jobsHead.appendChild(el('span', { style: { fontSize: '11px', color: 'var(--muted)' }, text: state.jobs.length + ' job' + (state.jobs.length !== 1 ? 's' : '') }));
  }
  jobsSection.appendChild(jobsHead);

  if (state.jobs.length === 0) {
    const empty = el('div', { className: 'empty-state' });
    empty.appendChild(el('div', { className: 'empty-state-icon' }, [
      el('svg', { viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
        el('path', { d: 'M20 7h-4V5h4V3H7v2H3v2h17V7zM3 17h18v-2H3v2zM12 12v4M10 14h4' })
      ])
    ]));
    empty.appendChild(el('div', { className: 'empty-state-title', text: 'No income sources yet' }));
    empty.appendChild(el('div', { className: 'empty-state-desc', text: 'Add a job to start tracking your earnings. W-2 jobs count in full; 1099/gig jobs deduct expenses.' }));
    jobsSection.appendChild(empty);
  } else {
    // Render each job card
    state.jobs.forEach(job => {
      jobsSection.appendChild(renderJobCard(job));
    });
    // Add job card at bottom (dashed)
    const addCard = el('div', { className: 'add-job-card', onClick: () => openAddJobModal() });
    addCard.appendChild(el('div', { className: 'add-job-text' }, [
      el('svg', { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
        el('path', { d: 'M12 5v14M5 12h14' })
      ]),
      el('span', { text: 'Add another income source' })
    ]));
    addCard.appendChild(el('span', { className: 'add-job-shortcut', text: 'or click + above' }));
    jobsSection.appendChild(addCard);
  }
  appShell.appendChild(jobsSection);

  // ── LEDGER SECTION (bank statement style) ──
  appendLedgerSection(appShell);

  // ── BOTTOM NAV ──
  const bottomNav = el('nav', { className: 'bottom-nav' });
  const inner = el('div', { className: 'bottom-nav-inner' });
  inner.appendChild(el('button', {
    className: 'nav-item',
    onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [
    el('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      el('path', { d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }),
      el('polyline', { points: '9 22 9 12 15 12 15 22' })
    ]),
    el('span', { text: 'Jobs' })
  ]));
  inner.appendChild(el('button', {
    className: 'nav-item',
    onClick: () => {
      const ledger = root.querySelector('.ledger-scroll');
      if (ledger) ledger.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [
    el('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      el('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }),
      el('line', { x1: 3, y1: 9, x2: 21, y2: 9 }),
      el('line', { x1: 9, y1: 21, x2: 9, y2: 9 })
    ]),
    el('span', { text: 'Ledger' })
  ]));
  inner.appendChild(el('button', {
    className: 'nav-item',
    onClick: () => {
      const gauge = root.querySelector('.gauge-section');
      if (gauge) gauge.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [
    el('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      el('path', { d: 'M22 12h-4l-3 9L9 3l-3 9H2' })
    ]),
    el('span', { text: 'Limit' })
  ]));
  bottomNav.appendChild(inner);
  appShell.appendChild(bottomNav);

  root.appendChild(appShell);
}

// ── RENDER JOB CARD ──
function renderJobCard(job) {
  const card = el('div', {
    className: 'job-card' + (expandedJobId === job.id ? ' active' : ''),
    id: 'job-' + job.id
  });

  // Header
  const header = el('div', { className: 'job-card-header', onClick: () => {
    expandedJobId = expandedJobId === job.id ? null : job.id;
    flashJobId = job.id;
    render();
  }});
  // Badge
  const badge = el('span', {
    className: 'job-badge ' + (job.type === 'W-2' ? 'w2' : '1099'),
    text: job.type === 'W-2' ? 'W-2' : '1099'
  });
  // Name
  let nameEl;
  if (flashJobId === job.id) {
    // Inline editable during flash
    nameEl = el('input', {
      className: 'job-name-input',
      type: 'text',
      value: job.name,
      autoFocus: true,
      onClick: (e) => e.stopPropagation(),
      onKeyDown: (e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          const v = e.target.value.trim();
          if (v) editJob(job.id, { name: v });
          flashJobId = null;
          render();
        } else if (e.key === 'Escape') {
          e.stopPropagation();
          flashJobId = null;
          render();
        }
      },
      onBlur: () => {
        const v = e.target.value.trim();
        if (v && v !== job.name) editJob(job.id, { name: v });
        flashJobId = null;
        render();
      }
    });
    header.appendChild(nameEl);
  } else {
    header.appendChild(el('span', { className: 'job-name', text: job.name }));
  }
  header.appendChild(badge);

  // Status buttons
  const statusGroup = el('div', { className: 'job-status' });
  ['ongoing', 'paused', 'ended'].forEach(s => {
    statusGroup.appendChild(el('button', {
      className: 'status-btn' + (job.status === s ? ' active-' + s : ''),
      onClick: (e) => { e.stopPropagation(); setJobStatus(job.id, s); },
      text: STATUS_TEXT[s],
      title: s === 'ongoing' ? 'Currently working' : (s === 'paused' ? 'Not working right now' : 'Job ended')
    }));
  });
  header.appendChild(statusGroup);
  card.appendChild(header);

  // Meta
  const meta = el('div', { className: 'job-meta' });
  // Pay cycle
  const cycleMap = { weekly: 'Weekly', biweekly: 'Bi-weekly', semimonthly: 'Semi-monthly', monthly: 'Monthly' };
  meta.appendChild(el('span', { className: 'job-meta-item' }, [
    el('span', { className: 'label', text: 'Cycle' }),
    el('span', { className: 'value', text: cycleMap[job.cycle] || job.cycle })
  ]));
  // Rate
  meta.appendChild(el('span', { className: 'job-meta-item' }, [
    el('span', { className: 'label', text: 'Rate' }),
    el('span', { className: 'value', text: job.rate ? '$' + job.rate.toFixed(2) + '/hr' : '--' })
  ]));
  // Pay date
  meta.appendChild(el('span', { className: 'job-meta-item' }, [
    el('span', { className: 'label', text: 'Payday' }),
    el('span', { className: 'value', text: job.payDate || '—' })
  ]));
  // YTD
  const ytd = jobYTD(job);
  meta.appendChild(el('span', { className: 'job-ytd' }, [
    el('div', { className: 'job-ytd-value', text: '$' + fmt(ytd) }),
    el('div', { className: 'job-ytd-label', text: 'YTD counted' })
  ]));
  card.appendChild(meta);

  // Actions
  const actions = el('div', { className: 'job-actions' });
  actions.appendChild(el('button', {
    className: 'job-edit-btn',
    title: 'Edit job',
    onClick: (e) => { e.stopPropagation(); openEditJobModal(job.id); }
  }, [
    el('svg', { viewBox: '0 0 24 24', width: 14, height: 14, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      el('path', { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }),
      el('path', { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' })
    ])
  ]));
  actions.appendChild(el('button', {
    className: 'job-delete-btn',
    title: 'Delete job',
    onClick: (e) => { e.stopPropagation(); deleteJob(job.id); }
  }, [
    el('svg', { viewBox: '0 0 24 24', width: 14, height: 14, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      el('polyline', { points: '3 6 5 6 21 6' }),
      el('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' })
    ])
  ]));
  card.appendChild(actions);

  // Edit panel (if expanded)
  if (expandedJobId === job.id) {
    const panel = el('div', { className: 'job-edit-panel' });
    const editRows = [
      ({ label: 'Job name', html: el('div', { className: 'job-edit-row' }, [
        el('label', { className: 'job-edit-label', text: 'Name' }),
        el('input', {
          className: 'job-edit-input',
          type: 'text',
          value: job.name,
          onKeyDown: (e) => {
            if (e.key === 'Enter') {
              const v = e.target.value.trim();
              if (v) editJob(job.id, { name: v });
              expandedJobId = null;
              render();
            }
          }
        })
      ]) }),
      ({ label: 'Type', html: el('div', { className: 'job-edit-row' }, [
        el('label', { className: 'job-edit-label', text: 'Type' }),
        el('select', {
          className: 'job-edit-select',
          onChange: (e) => editJob(job.id, { type: e.target.value }),
          value: job.type
        }, [
          el('option', { value: 'W-2' }, 'W-2 (counts in full)'),
          el('option', { value: '1099' }, '1099 (deduct expenses)'),
          el('option', { value: 'gig' }, 'Gig (deduct expenses)')
        ])
      ]) }),
      ({ label: 'Hourly rate', html: el('div', { className: 'job-edit-row' }, [
        el('label', { className: 'job-edit-label', text: 'Rate ($/hr)' }),
        el('input', {
          className: 'job-edit-input mono',
          type: 'number',
          value: job.rate || '',
          min: 0,
          step: 0.01,
          placeholder: 'Optional',
          onKeyDown: (e) => {
            if (e.key === 'Enter') {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) editJob(job.id, { rate: v });
              expandedJobId = null;
              render();
            }
          }
        })
      ]) }),
      ({ label: 'Pay cycle', html: el('div', { className: 'job-edit-row' }, [
        el('label', { className: 'job-edit-label', text: 'Cycle' }),
        el('select', {
          className: 'job-edit-select',
          onChange: (e) => editJob(job.id, { cycle: e.target.value }),
          value: job.cycle
        }, [
          el('option', { value: 'weekly' }, 'Weekly'),
          el('option', { value: 'biweekly' }, 'Bi-weekly'),
          el('option', { value: 'semimonthly' }, 'Semi-monthly'),
          el('option', { value: 'monthly' }, 'Monthly')
        ])
      ]) }),
      ({ label: 'Anchor payday', html: el('div', { className: 'job-edit-row' }, [
        el('label', { className: 'job-edit-label', text: 'Day' }),
        el('input', {
          className: 'job-edit-input mono',
          type: 'number',
          value: job.anchorDay || 15,
          min: 1,
          max: 28,
          onKeyDown: (e) => {
            if (e.key === 'Enter') {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1 && v <= 28) editJob(job.id, { anchorDay: v });
              expandedJobId = null;
              render();
            }
          }
        })
      ]) }),
      ({ label: 'Paychecks per cycle', html: el('div', { className: 'job-edit-row' }, [
        el('label', { className: 'job-edit-label', text: 'Count' }),
        el('input', {
          className: 'job-edit-input mono',
          type: 'number',
          value: job.paychecks || 1,
          min: 1,
          max: 52,
          onKeyDown: (e) => {
            if (e.key === 'Enter') {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1) editJob(job.id, { paychecks: v });
              expandedJobId = null;
              render();
            }
          }
        })
      ]) }),
      ({ label: 'Planning rate', html: el('div', { className: 'job-edit-row' }, [
        el('label', { className: 'job-edit-label', text: 'Rate ($/mo)' }),
        el('input', {
          className: 'job-edit-input mono',
          type: 'number',
          value: job.planningRate || SGA_TRIAL,
          min: 0,
          step: 10,
          onKeyDown: (e) => {
            if (e.key === 'Enter') {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) editJob(job.id, { planningRate: v });
              expandedJobId = null;
              render();
            }
          }
        })
      ]) }),
      ({ label: 'Start date', html: el('div', { className: 'job-edit-row' }, [
        el('label', { className: 'job-edit-label', text: 'Since' }),
        el('input', {
          className: 'job-edit-input',
          type: 'month',
          value: job.startDate || '',
          onKeyDown: (e) => {
            if (e.key === 'Enter') {
              editJob(job.id, { startDate: e.target.value });
              expandedJobId = null;
              render();
            }
          }
        })
      ]) })
    ];
    editRows.forEach(r => panel.appendChild(r.html));
    // Close panel hint
    panel.appendChild(el('div', { style: { marginTop: 8, fontSize: '11px', color: 'var(--muted)', cursor: 'pointer' }, text: 'Press Enter to save, Esc to cancel', onClick: () => { expandedJobId = null; render(); } }));
    card.appendChild(panel);
  }

  return card;
}

// ── LEDGER (bank-statement style) ──
function appendLedgerSection(root) {
  const section = el('section', { className: 'ledger-section' });
  section.appendChild(el('div', { className: 'section-head' }, [
    el('span', { className: 'section-label' }, [
      el('span', { className: 'dot' }),
      el('span', { text: 'Earnings Ledger — ' + todayMonth().year })
    ]),
    el('span', { style: { fontSize: '11px', color: 'var(--muted)' }, text: 'Click any entry to edit · grouped by job' })
  ]));

  const ledgerScroll = el('div', { className: 'ledger-scroll' });

  if (state.jobs.length === 0 || state.entries.length === 0) {
    const empty = el('div', { className: 'empty-state' });
    if (state.jobs.length === 0) {
      empty.appendChild(el('div', { className: 'empty-state-title', text: 'No jobs to show' }));
      empty.appendChild(el('div', { className: 'empty-state-desc', text: 'Add a job to see your ledger.' }));
    } else {
      empty.appendChild(el('div', { className: 'empty-state-title', text: 'No entries yet' }));
      empty.appendChild(el('div', { className: 'empty-state-desc', text: 'Click + Add Entry on any job to log your pay.' }));
    }
    ledgerScroll.appendChild(empty);
    section.appendChild(ledgerScroll);
    root.appendChild(section);
    return;
  }

  const table = el('table', { className: 'ledger-table' });

  // HEADER ROW
  const thead = el('thead');
  const headerRow = el('tr');
  headerRow.appendChild(el('th', { style: { width: '140px', minWidth: '120px' }, text: '' }));
  headerRow.appendChild(el('th', { text: 'Pay Date' }));
  headerRow.appendChild(el('th', { text: 'Job' }));
  headerRow.appendChild(el('th', { text: 'Hours' }));
  headerRow.appendChild(el('th', { className: 'right', text: 'Gross' }));
  headerRow.appendChild(el('th', { className: 'right', text: 'Deductions' }));
  headerRow.appendChild(el('th', { className: 'right', text: 'Net' }));
  // 12 month columns
  const currentY = todayMonth().year;
  MONTHS_SHORT.forEach((mName, mi) => {
    headerRow.appendChild(el('th', {
      className: 'month-col' + (mi === todayMonth().month && currentY === todayMonth().year ? ' current' : ''),
      style: { minWidth: '56px', width: '56px' }
    }, [
      el('div', { className: 'month-name', text: mName }),
    ]));
  });
  headerRow.appendChild(el('th', { className: 'right', text: 'Notes' }));
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // BODY
  const tbody = el('tbody');
  let grandTotal = 0;
  let grandTotalClass = 'ledger-grand-total';

  // Group by job
  state.jobs.forEach(job => {
    const jobEntries = state.entries
      .filter(e => e.jobId === job.id)
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        if (a.month !== b.month) return a.month - b.month;
        return (a.payDate || '').localeCompare(b.payDate || '');
      });

    if (jobEntries.length === 0) return;

    // Group header row
    const groupHeader = el('tr', { className: 'ledger-group-header' });
    const groupCell = el('td', { colSpan: 7 + 12 + 1, style: { padding: '10px 12px' } });
    const groupInner = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } });
    groupInner.appendChild(el('span', {
      className: 'job-name',
      text: job.name
    }));
    groupInner.appendChild(el('span', {
      style: { fontFamily: "'DM Mono', monospace", fontSize: '12px', color: 'var(--text-2)', fontWeight: 600 }
    }, ['$' + fmt(jobYTD(job)) + ' YTD']));
    groupCell.appendChild(groupInner);
    groupHeader.appendChild(groupCell);
    // Per-month mini totals in group header
    const ytdByMonth = MONTHS_SHORT.map((_, mi) => jobMonthTotal(job, jobEntries[0].year, mi));
    // Show small per-month totals inline? skip for compactness.
    tbody.appendChild(groupHeader);

    // Entry rows
    jobEntries.forEach(entry => {
      const counted = countedAmount(job, entry);
      const row = el('tr', { className: 'ledger-row-entry' });
      // Job/date
      row.appendChild(el('td', { style: { whiteSpace: 'nowrap' } }, [
        el('button', {
          className: 'entry-edit-btn',
          onClick: () => openEditEntryModal(entry.id),
          title: 'Edit entry'
        }, [
          el('svg', { viewBox: '0 0 24 24', width: 12, height: 12, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
            el('path', { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }),
            el('path', { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' })
          ])
        ])
      ]));
      row.appendChild(el('td', { className: 'ledger-entry-date', text: entry.payDate || (MONTHS_SHORT[entry.month] + ' ' + entry.year) }));
      row.appendChild(el('td', { text: job.name }));
      row.appendChild(el('td', { className: 'mono', text: entry.hours || '—', style: { color: 'var(--muted)' } }));
      row.appendChild(el('td', { className: 'right ledger-entry-amount', text: fmtMoney(entry.amount) }));
      row.appendChild(el('td', { className: 'right ledger-entry-amount zero', text: entry.deductions ? fmtMoney(entry.deductions) : '—' }));
      row.appendChild(el('td', {
        className: 'right ledger-entry-amount' + (counted > SGA_TRIAL ? ' over' : ''),
        text: fmtMoney(counted)
      }));

      // Per-month columns — highlight the month this entry belongs to
      for (let mi = 0; mi < 12; mi++) {
        const isThisMonth = entry.year === currentY && entry.month === mi;
        const cls = 'month-col' + (isThisMonth ? ' current' : '');
        row.appendChild(el('td', {
          className: cls,
          style: { padding: '10px 4px', fontSize: '12px' }
        }, [
          el('span', {
            className: 'month-value' + (isThisMonth ? ' zero' : ''),
            text: isThisMonth ? fmtMoney(entry.amount) : '—',
            style: { opacity: isThisMonth ? 1 : 0.3 }
          })
        ]));
      }

      // Actions (edit + delete)
      const actionsCell = el('td', { className: 'right ledger-actions-cell' });
      actionsCell.appendChild(el('button', {
        className: 'entry-edit-btn',
        onClick: () => openEditEntryModal(entry.id),
        title: 'Edit'
      }, [
        el('svg', { viewBox: '0 0 24 24', width: 13, height: 13, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
          el('path', { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }),
          el('path', { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' })
        ])
      ]));
      actionsCell.appendChild(el('button', {
        className: 'entry-delete-btn',
        onClick: () => deleteEntry(entry.id),
        title: 'Delete'
      }, [
        el('svg', { viewBox: '0 0 24 24', width: 13, height: 13, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
          el('polyline', { points: '3 6 5 6 21 6' }),
          el('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' })
        ])
      ]));
      row.appendChild(actionsCell);

      tbody.appendChild(row);
    });

    // Job monthly totals row
    const jobTotal = jobYearTotal(job, jobEntries[0].year);
    const jobTotalRow = el('tr', { className: 'ledger-month-total' });
    jobTotalRow.appendChild(el('td', { colSpan: 2 }));
    jobTotalRow.appendChild(el('td', { style: { fontWeight: 600, color: 'var(--text)' } }, [
      el('span', { text: 'Total — ' + job.name })
    ]));
    jobTotalRow.appendChild(el('td', { className: 'right', text: '' }));
    jobTotalRow.appendChild(el('td', { className: 'right ledger-entry-amount', text: fmtMoney(jobMonthTotal(job, currentY, jobEntries[0].month >= 0 && jobEntries[0].month < 12 ? jobEntries[0].month : 0)) }));
    jobTotalRow.appendChild(el('td', { className: 'right ledger-entry-amount zero', text: job.deductionsTotal ? fmtMoney(job.deductionsTotal) : '—' }));
    jobTotalRow.appendChild(el('td', {
      className: 'right ledger-entry-amount' + (jobTotal > SGA_TRIAL ? ' over' : ''),
      style: { fontWeight: 700, fontFamily: "'DM Mono', monospace" },
      text: fmtMoney(jobTotal)
    }));
    // Fill month totals
    for (let mi = 0; mi < 12; mi++) {
      const mVal = jobMonthTotal(job, jobEntries[0].year, mi);
      jobTotalRow.appendChild(el('td', {
        className: 'month-col' + (mi === todayMonth().month ? ' current' : ''),
        style: { padding: '10px 4px' }
      }, [
        el('span', {
          className: 'month-value' + (mVal === 0 ? ' zero' : ''),
          text: mVal ? fmtMoney(mVal) : '—',
          style: { fontWeight: 600 }
        })
      ]));
    }
    jobTotalRow.appendChild(el('td', { text: '' }));
    tbody.appendChild(jobTotalRow);

    grandTotal += jobTotal;
  });

  // Grand total row
  const grandRow = el('tr', {
    className: 'ledger-grand-total' + (grandTotal > SGA_TRIAL ? ' over' : (grandTotal > SGA_TRIAL * 0.85 ? ' careful' : ''))
  });
  grandRow.appendChild(el('td', { text: '' }));
  grandRow.appendChild(el('td', { text: '' }));
  const grandLabel = el('td', { style: { fontWeight: 700, fontSize: '14px' } }, [
    el('span', { text: 'Total — All Jobs (' + todayMonth().year + ')' })
  ]);
  grandRow.appendChild(grandLabel);
  grandRow.appendChild(el('td', { text: '' }));
  grandRow.appendChild(el('td', {
    className: 'right amount',
    style: { fontFamily: "'DM Mono', monospace", fontSize: '16px', fontWeight: 700 }
  }, [fmtMoney(grandTotal)]));
  grandRow.appendChild(el('td', { text: '' }));
  grandRow.appendChild(el('td', {
    className: 'right amount',
    style: { fontFamily: "'DM Mono', monospace", fontSize: '16px', fontWeight: 700 }
  }, [fmtMoney(grandTotal)]));
  // Month columns for grand total
  for (let mi = 0; mi < 12; mi++) {
    let mTotal = 0;
    state.jobs.forEach(job => {
      mTotal += jobMonthTotal(job, currentY, mi);
    });
    grandRow.appendChild(el('td', {
      className: 'month-col current',
      style: { padding: '12px 4px', fontWeight: 700 }
    }, [
      el('span', {
        className: 'month-value' + (mTotal === 0 ? ' zero' : ''),
        style: { fontSize: '13px' },
        text: mTotal ? fmtMoney(mTotal) : '—'
      })
    ]));
  }
  grandRow.appendChild(el('td', { text: '' }));
  tbody.appendChild(grandRow);

  table.appendChild(tbody);
  ledgerScroll.appendChild(table);
  section.appendChild(ledgerScroll);
  root.appendChild(section);
}

// ── TWP DOTS ──
function twpDotClass(i) {
  const used = countTwpUsed();
  const current = todayMonth();
  // Determine if this dot is historical, current, used, or future
  if (i < used) return 'used';
  if (i === used && used < TWP_TOTAL) return 'current';
  return 'future';
}

function countTwpUsed() {
  // Count entries that triggered a TWP service month (one per month with any entry)
  const months = new Set();
  state.entries.forEach(e => {
    months.add(e.year + '-' + e.month);
  });
  // Only count months within TWP window (last 9 months from now or starting point)
  const sorted = Array.from(months).sort();
  // Count the most recent 9 months that have entries
  return Math.min(sorted.length, TWP_TOTAL);
}

// ── ADD JOB MODAL ──
function openAddJobModal() {
  const body = el('div');
  const fields = [
    editorRow('Job name', textInput('', { placeholder: 'e.g. Riverside Market', required: true })),
    selectInput([
      ['W-2', 'W-2 — Counts in full'],
      ['1099', '1099 — Deduct expenses'],
      ['gig', 'Gig — Deduct expenses']
    ], 'W-2', (e) => {}, 'Type'),
    editorRow('Hourly rate ($)',
      el('input', {
        type: 'number',
        className: 'modal-input mono',
        placeholder: 'Optional, e.g. 21.50',
        value: '',
        min: 0,
        step: 0.01
      })
    ),
    selectInput([
      ['weekly', 'Weekly'],
      ['biweekly', 'Bi-weekly'],
      ['semimonthly', 'Semi-monthly'],
      ['monthly', 'Monthly']
    ], 'monthly', (e) => {}, 'Pay cycle'),
    editorRow('Anchor payday (day of month)',
      el('input', {
        type: 'number',
        className: 'modal-input mono',
        placeholder: '1-28',
        value: '15',
        min: 1,
        max: 28
      })
    ),
    editorRow('Planning rate ($/month)',
      el('input', {
        type: 'number',
        className: 'modal-input mono',
        placeholder: 'e.g. 1210',
        value: String(SGA_TRIAL),
        min: 0,
        step: 10
      })
    ),
    editorRow('Paychecks per cycle',
      el('input', {
        type: 'number',
        className: 'modal-input mono',
        placeholder: 'e.g. 1',
        value: '1',
        min: 1,
        max: 52
      })
    ),
    editorRow('Start date',
      el('input', {
        type: 'month',
        className: 'modal-input',
        value: dateKey(todayMonth().year, todayMonth().month)
      })
    )
  ];
  fields.forEach(f => body.appendChild(f));
  const hint = el('p', { className: 'modal-hint', text: 'W-2 jobs count your entire gross in the SGA trial. 1099/gig jobs count gross minus deductions (mileage, disability work costs).' });
  body.appendChild(hint);
  const footer = el('div', { className: 'modal-footer' }, [
    el('button', { className: 'btn btn-ghost', text: 'Cancel', onClick: closeModal }),
    el('button', {
      className: 'btn btn-primary',
      text: 'Add Job',
      onClick: () => {
        const inputs = body.querySelectorAll('input, select');
        const name = inputs[0].value.trim();
        const type = inputs[1].value;
        const rate = parseFloat(inputs[2].value) || 0;
        const cycle = inputs[3].value;
        const anchorDay = parseInt(inputs[4].value, 10) || 15;
        const planningRate = parseFloat(inputs[5].value) || SGA_TRIAL;
        const paychecks = parseInt(inputs[6].value, 10) || 1;
        const startDate = inputs[7].value || dateKey(todayMonth().year, todayMonth().month);
        if (!name) {
          showToast('Enter a job name', 'error');
          return;
        }
        addJob({
          name, type, rate, cycle, anchorDay, planningRate, paychecks, startDate,
          status: 'ongoing'
        });
        closeModal();
      }
    })
  ]);
  openModal('Add Income Source', body, footer);
}

// ── EDIT JOB MODAL ──
function openEditJobModal(jobId) {
  const job = state.jobs.find(j => j.id === jobId);
  if (!job) return;
  const body = el('div');
  const fields = [
    editorRow('Job name', textInput(job.name, { required: true })),
    selectInput([
      ['W-2', 'W-2 — Counts in full'],
      ['1099', '1099 — Deduct expenses'],
      ['gig', 'Gig — Deduct expenses']
    ], job.type, (e) => {}, 'Type'),
    editorRow('Hourly rate ($)',
      el('input', {
        type: 'number',
        className: 'modal-input mono',
        placeholder: 'Optional',
        value: job.rate || '',
        min: 0,
        step: 0.01
      })
    ),
    selectInput([
      ['weekly', 'Weekly'],
      ['biweekly', 'Bi-weekly'],
      ['semimonthly', 'Semi-monthly'],
      ['monthly', 'Monthly']
    ], job.cycle, (e) => {}, 'Pay cycle'),
    editorRow('Anchor payday (day of month)',
      el('input', {
        type: 'number',
        className: 'modal-input mono',
        value: job.anchorDay || 15,
        min: 1,
        max: 28
      })
    ),
    editorRow('Planning rate ($/month)',
      el('input', {
        type: 'number',
        className: 'modal-input mono',
        value: job.planningRate || SGA_TRIAL,
        min: 0,
        step: 10
      })
    ),
    editorRow('Paychecks per cycle',
      el('input', {
        type: 'number',
        className: 'modal-input mono',
        value: job.paychecks || 1,
        min: 1,
        max: 52
      })
    ),
    editorRow('Start date',
      el('input', {
        type: 'month',
        className: 'modal-input',
        value: job.startDate || ''
      })
    )
  ];
  fields.forEach(f => body.appendChild(f));
  const footer = el('div', { className: 'modal-footer' }, [
    el('button', { className: 'btn btn-ghost', text: 'Cancel', onClick: closeModal }),
    el('button', {
      className: 'btn btn-primary',
      text: 'Save',
      onClick: () => {
        const inputs = body.querySelectorAll('input, select');
        const name = inputs[0].value.trim();
        const type = inputs[1].value;
        const rate = parseFloat(inputs[2].value) || 0;
        const cycle = inputs[3].value;
        const anchorDay = parseInt(inputs[4].value, 10) || 15;
        const planningRate = parseFloat(inputs[5].value) || SGA_TRIAL;
        const paychecks = parseInt(inputs[6].value, 10) || 1;
        const startDate = inputs[7].value || '';
        editJob(jobId, {
          name: name || job.name,
          type,
          rate,
          cycle,
          anchorDay,
          planningRate,
          paychecks,
          startDate
        });
        closeModal();
      }
    })
  ]);
  openModal('Edit — ' + job.name, body, footer);
}

// ── APP INIT ──
function init() {
  // Load from localStorage
  state = loadState();
  // Set default planning rate from first job or SGA
  render();
}
document.addEventListener('DOMContentLoaded', init);
// Also run immediately if DOM already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  init();
} else {
  document.addEventListener('DOMContentLoaded', init);
}
