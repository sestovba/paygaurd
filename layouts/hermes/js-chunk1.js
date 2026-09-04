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
