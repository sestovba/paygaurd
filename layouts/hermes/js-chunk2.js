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
