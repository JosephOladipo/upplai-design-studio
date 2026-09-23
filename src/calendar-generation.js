import { calendarRowToDesignInput } from './design-controller.js';
import { normalizeStatus, rowsInOrder } from './calendar.js';

const eligible = new Set(['ready', 'stale']);
const replace = (rows, row) => rows.map(item => item.id === row.id ? row : item);
const compactError = error => String(error?.message || error || 'Generation failed.').replace(/\s+/g, ' ').slice(0, 180);

export function todayEligibleIds(rows, today) {
  return new Set(rowsInOrder(rows)
    .filter(row => row.date === today && eligible.has(normalizeStatus(row.status)))
    .map(row => row.id));
}

export function createCalendarQueue(generate, now = () => new Date().toISOString()) {
  let running = false;
  return {
    get running() { return running; },
    async run(rows, selectedIds, onRows = () => {}) {
      if (running) return { blocked: true, rows, summary: null };
      running = true;
      let current = [...rows];
      const results = new Map();
      const summary = { selected: 0, generated: 0, alreadyGenerated: 0, skipped: 0, failed: 0 };
      try {
        for (const selected of rowsInOrder(rows).filter(row => selectedIds.has(row.id))) {
          summary.selected++;
          if (!eligible.has(normalizeStatus(selected.status))) {
            if (normalizeStatus(selected.status) === 'generated') summary.alreadyGenerated++;
            else summary.skipped++;
            continue;
          }
          let row = { ...current.find(item => item.id === selected.id), status: 'generating', error: null };
          current = replace(current, row); await onRows(current, row, summary);
          try {
            results.set(row.id, await generate(row.contentFormat === 'carousel' ? row : calendarRowToDesignInput(row))); 
            row = { ...row, status: 'generated', generatedAt: now(), error: null, resultRef: null };
            summary.generated++;
          } catch (error) {
            row = { ...row, status: 'failed', generatedAt: null, error: compactError(error) };
            summary.failed++;
          }
          current = replace(current, row); await onRows(current, row, summary);
        }
        return { blocked: false, rows: current, summary, results };
      } finally { running = false; }
    }
  };
}
