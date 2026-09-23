const columns = [
  'Date',
  'Headline',
  'Supporting Copy',
  'CTA',
  'Design Method',
  'Visual Style',
  'Visual Subject',
  'Composition',
  'Visual Direction',
  'Quality',
  'Content Format'
];

import {
  importCalendarCsv,
  loadCalendar,
  saveCalendar,
  clearCalendar,
  createManualRow,
  updateManualRow,
  deleteCalendarRow,
  shouldConfirmCalendarReplacement,
  localDateKey
} from '/src/calendar.js';
import { designStyles } from '/src/styles.js';
import { visualStyles, subjectTypes, compositions } from '/src/ai-plan.mjs';

const exampleRows = [
  [
    '2026-09-21',
    '5 Resume Mistakes Costing You Interviews',
    'Small resume mistakes can prevent strong candidates from reaching the interview stage.',
    'Check Your Resume',
    'Bold Statement',
    '', '', '', '', ''
  ],
  [
    '2026-09-22',
    '4 Interview Hacks That Actually Work',
    'Small changes in how you prepare can make a big difference.',
    'Learn More',
    'OpenAI Style',
    'Editorial',
    'No Main Subject',
    'Left',
    'Premium modern interview environment, no people, soft daylight, clean professional atmosphere, leave negative space on the left for headline text.',
    'Draft'
  ]
];

const escapeCell = value => {
  const cell = String(value ?? '');
  return /[",\r\n]/.test(cell)
    ? `"${cell.replaceAll('"', '""')}"`
    : cell;
};

function downloadTemplate() {
  const csv = [columns, ...exampleRows]
    .map(row => row.map(escapeCell).join(','))
    .join('\r\n');
  const blob = new Blob([`\uFEFF${csv}\r\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'upplai-content-calendar-template.csv';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const downloadButton = document.getElementById('download-calendar-template');
const upload = document.getElementById('calendar-csv');
const status = document.getElementById('calendar-status');
const importErrors = document.getElementById('calendar-import-errors');
const empty = document.getElementById('calendar-empty');
const clearButton = document.getElementById('clear-calendar');
const addButton = document.getElementById('add-calendar-post');
const manualForm = document.getElementById('manual-calendar-form');
const manualErrors = document.getElementById('manual-calendar-errors');
const manualStyle = document.getElementById('manual-style');
const manualAi = document.getElementById('manual-ai-fields');
let editingId = null;
for (const style of designStyles) manualStyle.add(new Option(style.name, style.id));
const labelFor = value => value === 'auto' ? 'Auto' : value === 'none' ? 'No Main Subject' : value === '3d' ? '3D' : value[0].toUpperCase() + value.slice(1);
const fill = (element, values) => values.forEach(value => element.add(new Option(labelFor(value), value)));
fill(document.getElementById('manual-visual-style'), visualStyles);
fill(document.getElementById('manual-subject'), subjectTypes);
fill(document.getElementById('manual-composition'), ['auto', ...compositions]);
function openManualForm(row) {
  editingId = row?.id ?? null;
  manualForm.reset();
  document.getElementById('manual-date').value = row?.date ?? localDateKey();
  document.getElementById('manual-headline').value = row?.headline ?? '';
  document.getElementById('manual-copy').value = row?.supportingCopy ?? '';
  document.getElementById('manual-cta').value = row?.cta ?? '';
  document.getElementById('manual-content-format').value = row?.contentFormat ?? 'single-image';
  manualStyle.value = row?.style ?? 'premium-editorial';
  document.getElementById('manual-visual-style').value = row?.ai?.visualStyle ?? 'auto';
  document.getElementById('manual-subject').value = row?.ai?.subjectType ?? 'auto';
  document.getElementById('manual-composition').value = row?.ai?.composition ?? 'auto';
  document.getElementById('manual-direction').value = row?.ai?.direction ?? '';
  document.getElementById('manual-quality').value = row?.ai?.quality ?? 'draft';
  manualErrors.textContent = '';
  manualAi.hidden = manualStyle.value !== 'openai-style';
  manualForm.querySelector('h2').textContent = editingId ? 'Edit Post' : 'Add Post';
  manualForm.querySelector('[type="submit"]').textContent = editingId ? 'Save Changes' : 'Save Post';
  manualForm.hidden = false;
}
addButton.addEventListener('click', () => openManualForm());
document.addEventListener('calendar:edit', event => {
  const row = (loadCalendar()?.rows || []).find(item => item.id === event.detail?.id);
  if (row && row.contentFormat !== 'carousel') openManualForm(row);
});
document.addEventListener('calendar:delete', event => {
  const id = event.detail?.id;
  const existing = loadCalendar()?.rows || [];
  const row = existing.find(item => item.id === id);
  if (!row || !window.confirm(`Delete “${row.headline}” from the Calendar?`)) return;
  saveCalendar(deleteCalendarRow(existing, id));
  status.textContent = 'Post deleted from Calendar.';
  document.dispatchEvent(new CustomEvent('calendar:changed', { detail: { removedId: id, resultRef: row.resultRef } }));
});
manualStyle.addEventListener('change', () => { manualAi.hidden = manualStyle.value !== 'openai-style'; });
document.getElementById('cancel-calendar-post').addEventListener('click', () => { editingId = null; manualForm.hidden = true; manualForm.reset(); });
manualForm.addEventListener('submit', event => {
  event.preventDefault();
  const existing = loadCalendar()?.rows || [];
  const input = { date: document.getElementById('manual-date').value, headline: document.getElementById('manual-headline').value, supportingCopy: document.getElementById('manual-copy').value, cta: document.getElementById('manual-cta').value, contentFormat: document.getElementById('manual-content-format').value, carousel: existing.find(item => item.id === editingId)?.carousel, style: manualStyle.value, visualStyle: document.getElementById('manual-visual-style').value, subjectType: document.getElementById('manual-subject').value, composition: document.getElementById('manual-composition').value, direction: document.getElementById('manual-direction').value, quality: document.getElementById('manual-quality').value };
  const index = existing.findIndex(row => row.id === editingId);
  const result = index < 0 ? createManualRow(input, existing) : updateManualRow(existing[index], input);
  if (!result.row) { manualErrors.textContent = result.errors.join(' '); return; }
  const rows = index < 0 ? [...existing, result.row] : existing.map((row, rowIndex) => rowIndex === index ? result.row : row);
  saveCalendar(rows);
  manualForm.hidden = true; manualForm.reset();
  status.textContent = index < 0 ? 'Post added to Calendar.' : 'Post updated.';
  editingId = null;
  document.dispatchEvent(new CustomEvent('calendar:changed'));
});

function showSavedCalendar(calendar) {
  const count = calendar.rows.length;
  empty.hidden = true;
  clearButton.hidden = false;
  status.textContent = `Calendar loaded. ${count} post${count === 1 ? '' : 's'} ready.`;
}

function showEmptyCalendar() {
  empty.hidden = false;
  clearButton.hidden = true;
}

function formatIssues(errors) {
  return errors.map(issue => `Row ${issue.row ?? 'CSV'} — ${issue.messages.join(' ')}`);
}

function showImportErrors(errors = []) {
  const list = importErrors.querySelector('ul');
  list.replaceChildren(...formatIssues(errors).map(message => {
    const item = document.createElement('li');
    item.textContent = message;
    return item;
  }));
  importErrors.hidden = !errors.length;
}

function adjustmentSummary(adjustments = {}) {
  const labels = [
    ['visualStylesNormalized', 'Visual Styles normalized'],
    ['visualSubjectsMoved', 'Visual Subjects moved to Visual Direction'],
    ['compositionsDefaulted', 'Compositions defaulted to Auto'],
    ['qualityDefaulted', 'Quality values defaulted to Draft']
  ];
  return labels.filter(([key]) => adjustments[key]).map(([key, label]) => `${adjustments[key]} ${label}`);
}

downloadButton.addEventListener('click', downloadTemplate);

upload.addEventListener('change', async () => {
  const file = upload.files?.[0];
  if (!file) return;
  try {
    const result = importCalendarCsv(await file.text());
    if (!result.rows.length) {
      status.textContent = `No posts imported from ${file.name}. ${result.errors.length} row${result.errors.length === 1 ? '' : 's'} need attention.`;
      showImportErrors(result.errors);
      return;
    }
    const existing = loadCalendar()?.rows || [];
    if (shouldConfirmCalendarReplacement(existing, result.rows) && !window.confirm('Importing this CSV will replace your current Calendar, including manually added posts. Continue?')) {
      upload.value = '';
      return;
    }
    const calendar = saveCalendar(result.rows);
    empty.hidden = true;
    clearButton.hidden = false;
    const changes = adjustmentSummary(result.adjustments);
    const attention = result.errors.length ? ` ${result.errors.length} row${result.errors.length === 1 ? '' : 's'} need attention.` : '';
    status.textContent = `${calendar.rows.length} post${calendar.rows.length === 1 ? '' : 's'} imported.${changes.length ? ` ${changes.join(' · ')}.` : ''}${attention}`;
    showImportErrors(result.errors);
    document.dispatchEvent(new CustomEvent('calendar:changed', { detail: { resetSelection: true, closeDetails: true } }));
  } catch {
    status.textContent = `Could not read ${file.name}. Choose a valid UTF-8 CSV file.`;
  }
});

clearButton.addEventListener('click', () => {
  const resultRefs = (loadCalendar()?.rows || []).map(row => row.resultRef).filter(Boolean);
  clearCalendar();
  upload.value = '';
  status.textContent = 'Calendar cleared.';
  showEmptyCalendar();
  showImportErrors();
  document.dispatchEvent(new CustomEvent('calendar:changed', { detail: { resetSelection: true, closeDetails: true, resultRefs } }));
});

const savedCalendar = loadCalendar();
if (savedCalendar) showSavedCalendar(savedCalendar);
else showEmptyCalendar();

export { columns, exampleRows, escapeCell };


