import { designStyles } from './styles.js';
import { visualStyles, subjectTypes, compositions } from './ai-plan.mjs';
import { normalizeCarousel, createCarouselDraft } from './carousel.js';

export const CALENDAR_STORAGE_KEY = 'upplai-design-studio:calendar:v1';
export const CALENDAR_STATUSES = ['ready', 'generating', 'generated', 'failed', 'stale', 'skipped'];
const QUALITY_VALUES = ['draft', 'standard', 'premium'];
const HEADER_NAMES = {
  date: 'date',
  headline: 'headline',
  supportingcopy: 'supportingCopy',
  cta: 'cta',
  designmethod: 'style',
  visualstyle: 'visualStyle',
  visualsubject: 'subjectType',
  composition: 'composition',
  visualdirection: 'direction',
  quality: 'quality',
  contentformat: 'contentFormat'
};

const compact = value => String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
const display = value => String(value ?? '').trim();

function valueMap(values) {
  return new Map(values.map(value => [compact(value), value]));
}

const styleMap = new Map(designStyles.flatMap(style => [
  [compact(style.id), style.id],
  [compact(style.name), style.id]
]));
const visualStyleMap = valueMap(visualStyles);
visualStyleMap.set(compact('Premium Editorial'), 'editorial');
visualStyleMap.set(compact('Minimal Tech'), 'minimal');
visualStyleMap.set(compact('High Contrast'), 'auto');
visualStyleMap.set(compact('Infographic'), 'illustration');
visualStyleMap.set(compact('Social Editorial'), 'editorial');
visualStyleMap.set(compact('Conceptual'), 'abstract');
visualStyleMap.set(compact('UI Inspired'), 'auto');
visualStyleMap.set(compact('Data Stat Inspired'), 'auto');
const subjectTypeMap = valueMap(subjectTypes);
subjectTypeMap.set(compact('No Main Subject'), 'none');
const compositionMap = valueMap(compositions);
compositionMap.set(compact('Auto'), 'auto');
compositionMap.set(compact('Split'), 'auto');
const qualityMap = valueMap(QUALITY_VALUES);
qualityMap.set(compact('Ready'), 'draft');

function appendDirection(direction, guidance) {
  const value = display(direction);
  const rawNote = display(guidance);
  const note = rawNote && /[.!?]$/.test(rawNote) ? rawNote : rawNote ? `${rawNote}.` : '';
  if (!note || compact(value).includes(compact(note))) return value;
  return [note, value].filter(Boolean).join(' ');
}

export function parseCsv(source) {
  const text = String(source ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"') {
      if (cell) throw new Error('Invalid quote placement in CSV.');
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index++;
      row.push(cell);
      if (row.some(item => item.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error('Unclosed quoted field in CSV.');
  row.push(cell);
  if (row.some(item => item.trim())) rows.push(row);
  return rows;
}

export function normalizeHeaders(headerRow) {
  const headers = {};
  for (const [index, header] of headerRow.entries()) {
    const name = HEADER_NAMES[compact(header)];
    if (name && !(name in headers)) headers[name] = index;
  }
  return headers;
}

function getCell(row, headers, name) {
  return display(headers[name] === undefined ? '' : row[headers[name]]);
}

export function normalizeDate(value) {
  const source = display(value);
  const match = source.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`
    ? null
    : `${year}-${month}-${day}`;
}

function normalizeEnum(value, values, map, label, fallback) {
  const source = display(value);
  if (!source) return { value: fallback };
  const normalized = map.get(compact(source));
  return normalized && values.includes(normalized)
    ? { value: normalized }
    : { error: `Invalid ${label}: ${source}` };
}

function normalizeComposition(value) {
  const source = display(value);
  if (!source || compact(source) === 'auto' || compact(source) === 'split') return { value: 'auto' };
  return normalizeEnum(source, compositions, compositionMap, 'Composition', 'auto');
}

function normalizeImportGuidance(value, values, map, fallback) {
  const source = display(value);
  if (!source) return { value: fallback, adjusted: false, guidance: '' };
  const normalized = map.get(compact(source));
  if (normalized && (values.includes(normalized) || normalized === 'auto')) {
    return { value: normalized, adjusted: compact(source) !== compact(normalized), guidance: '' };
  }
  return { value: fallback, adjusted: true, guidance: source };
}

function normalizeImportComposition(value) {
  const source = display(value);
  const normalized = normalizeImportGuidance(source, compositions, compositionMap, 'auto');
  const preserve = normalized.guidance || (source && normalized.value === 'auto' && compact(source) !== 'auto') ? source : '';
  return { ...normalized, guidance: preserve ? `${preserve} composition.` : '' };
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

export function fingerprint(row) {
  return hash(JSON.stringify({
    headline: row.headline,
    supportingCopy: row.supportingCopy,
    cta: row.cta,
    style: row.style,
    contentFormat: row.contentFormat || 'single-image',
    carousel: row.contentFormat === 'carousel' ? normalizeCarousel(row.carousel) : null,
    ai: row.ai
  }));
}

function normalizeRow(raw, rowNumber, order, headers) {
  const date = normalizeDate(getCell(raw, headers, 'date'));
  const headline = getCell(raw, headers, 'headline');
  const method = getCell(raw, headers, 'style');
  const errors = [];
  if (!date) errors.push('Invalid date. Use YYYY-MM-DD.');
  if (!headline) errors.push('Missing headline.');
  const style = method ? styleMap.get(compact(method)) : 'premium-editorial';
  if (!style) errors.push(`Unknown Design Method: ${method}`);
  const visualStyle = normalizeImportGuidance(getCell(raw, headers, 'visualStyle'), visualStyles, visualStyleMap, 'auto');
  const subjectType = normalizeImportGuidance(getCell(raw, headers, 'subjectType'), subjectTypes, subjectTypeMap, 'auto');
  const composition = normalizeImportComposition(getCell(raw, headers, 'composition'));
  const contentFormat = compact(getCell(raw, headers, 'contentFormat'));
  const normalizedFormat = contentFormat === 'carousel' ? 'carousel' : 'single-image';
  const quality = normalizeImportGuidance(getCell(raw, headers, 'quality'), QUALITY_VALUES, qualityMap, 'draft');
  if (errors.length) return { error: { row: rowNumber, messages: errors } };
  const row = {
    id: `calendar-${hash(`${rowNumber}|${date}|${headline}|${method}`)}`,
    order,
    date,
    headline,
    supportingCopy: getCell(raw, headers, 'supportingCopy'),
    cta: getCell(raw, headers, 'cta'),
    style,
    contentFormat: normalizedFormat,
    carousel: normalizedFormat === 'carousel' ? createCarouselDraft() : null,
    ai: {
      visualStyle: visualStyle.value,
      subjectType: subjectType.value,
      composition: composition.value,
      direction: appendDirection(appendDirection(getCell(raw, headers, 'direction'), composition.guidance), subjectType.guidance),
      quality: quality.value
    },
    status: 'ready',
    generatedAt: null,
    error: null,
    resultRef: null
  };
  row.inputFingerprint = fingerprint(row);
  return { row, adjustments: {
    visualStylesNormalized: Number(visualStyle.adjusted),
    visualSubjectsMoved: Number(Boolean(subjectType.guidance)),
    compositionsDefaulted: Number(composition.adjusted),
    qualityDefaulted: Number(quality.adjusted)
  } };
}

export function importCalendarCsv(source) {
  let parsed;
  try { parsed = parseCsv(source); } catch (error) {
    return { rows: [], errors: [{ row: null, messages: [error.message] }], warnings: [], totalRows: 0 };
  }
  if (!parsed.length) return { rows: [], errors: [{ row: null, messages: ['The CSV is empty.'] }], warnings: [], totalRows: 0 };
  const headers = normalizeHeaders(parsed[0]);
  const missing = ['date', 'headline'].filter(name => headers[name] === undefined);
  if (missing.length) return { rows: [], errors: [{ row: 1, messages: [`Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`] }], warnings: [], totalRows: Math.max(0, parsed.length - 1) };
  const rows = [];
  const errors = [];
  const adjustments = { visualStylesNormalized: 0, visualSubjectsMoved: 0, compositionsDefaulted: 0, qualityDefaulted: 0 };
  parsed.slice(1).forEach((raw, index) => {
    const result = normalizeRow(raw, index + 2, rows.length, headers);
    if (result.row) {
      rows.push(result.row);
      for (const key of Object.keys(adjustments)) adjustments[key] += result.adjustments[key];
    } else errors.push(result.error);
  });
  return { rows, errors, warnings: [], adjustments, totalRows: parsed.length - 1 };
}

export function loadCalendar(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(CALENDAR_STORAGE_KEY));
    return saved?.version === 1 && Array.isArray(saved.rows) ? saved : null;
  } catch { return null; }
}

export function saveCalendar(rows, storage = globalThis.localStorage, importedAt = new Date().toISOString()) {
  const calendar = { version: 1, importedAt, rows };
  storage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(calendar));
  return calendar;
}

export function clearCalendar(storage = globalThis.localStorage) {
  storage.removeItem(CALENDAR_STORAGE_KEY);
}

export function deleteCalendarRow(rows, id) {
  return rows.filter(row => row.id !== id);
}

export function shouldConfirmCalendarReplacement(existingRows, importedRows) {
  return existingRows.length > 0 && importedRows.length > 0;
}

export function normalizeStatus(status) {
  return CALENDAR_STATUSES.includes(status) ? status : 'ready';
}

export function localDateKey(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function rowsInOrder(rows) {
  return [...rows].sort((left, right) => left.order - right.order);
}

export function getSelectedRowsInOrder(rows, selectedIds) {
  return rowsInOrder(rows).filter(row => selectedIds.has(row.id));
}

export function selectAllRows(rows) {
  return new Set(rowsInOrder(rows).map(row => row.id));
}

export function selectTodayRows(rows, today = localDateKey()) {
  return new Set(rowsInOrder(rows).filter(row => row.date === today).map(row => row.id));
}

export function selectUngeneratedRows(rows) {
  return new Set(rowsInOrder(rows)
    .filter(row => ['ready', 'stale'].includes(normalizeStatus(row.status)))
    .map(row => row.id));
}

export function getTodayEligibleRows(rows, today = localDateKey()) {
  return rowsInOrder(rows).filter(row =>
    row.date === today && ['ready', 'stale'].includes(normalizeStatus(row.status)));
}

export function calendarSummary(rows, selectedIds = new Set(), today = localDateKey()) {
  const byStatus = Object.fromEntries(CALENDAR_STATUSES.map(status => [status, 0]));
  for (const row of rows) byStatus[normalizeStatus(row.status)]++;
  return {
    total: rows.length,
    selected: rows.filter(row => selectedIds.has(row.id)).length,
    today: rows.filter(row => row.date === today).length,
    eligibleToday: getTodayEligibleRows(rows, today).length,
    byStatus
  };
}

export function nextRowOrder(rows) {
  return rows.length ? Math.max(...rows.map(row => Number.isFinite(row.order) ? row.order : -1)) + 1 : 0;
}

export function createManualRow(input, rows = []) {
  const date = normalizeDate(input.date);
  const headline = display(input.headline);
  const style = styleMap.get(compact(input.style));
  const errors = [];
  if (!date) errors.push('Choose a valid date.');
  if (!headline) errors.push('Headline is required.');
  if (!style) errors.push('Choose a valid Design Method.');
  const visualStyle = normalizeEnum(input.visualStyle, visualStyles, visualStyleMap, 'Visual Style', 'auto');
  const subjectType = normalizeEnum(input.subjectType, subjectTypes, subjectTypeMap, 'Visual Subject', 'auto');
  const composition = normalizeComposition(input.composition);

  const quality = normalizeEnum(input.quality, QUALITY_VALUES, qualityMap, 'Quality', 'draft');
  for (const item of [visualStyle, subjectType, composition, quality]) if (item.error) errors.push(item.error);
  if (errors.length) return { errors };
  const contentFormat = input.contentFormat === 'carousel' ? 'carousel' : 'single-image';
  const order = nextRowOrder(rows);
  const row = { id: `calendar-manual-${hash(`${Date.now()}|${order}|${headline}`)}`, order, date, headline,
    supportingCopy: display(input.supportingCopy), cta: display(input.cta), style, contentFormat, carousel: contentFormat === 'carousel' ? normalizeCarousel(input.carousel || createCarouselDraft()) : null,
    ai: { visualStyle: visualStyle.value, subjectType: subjectType.value, composition: composition.value, direction: display(input.direction), quality: quality.value },
    status: 'ready', generatedAt: null, error: null, resultRef: null };
  row.inputFingerprint = fingerprint(row);
  return { row };
}

export function updateManualRow(existing, input) {
  const created = createManualRow(input);
  if (!created.row) return created;
  const row = {
    ...existing,
    ...created.row,
    id: existing.id,
    order: existing.order,
    generatedAt: existing.generatedAt,
    error: existing.error,
    resultRef: existing.resultRef
  };
  const relevantChange = fingerprint(existing) !== row.inputFingerprint;
  const previousStatus = normalizeStatus(existing.status);
  row.status = previousStatus === 'generated' && relevantChange ? 'stale' : previousStatus;
  return { row, relevantChange };
}
