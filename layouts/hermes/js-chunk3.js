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
