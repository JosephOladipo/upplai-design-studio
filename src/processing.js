let overlay;
let nextOperationId = 0;
const operations = new Map();

function ensure() {
  if (overlay?.isConnected) return overlay;
  overlay = document.querySelector('.app-processing');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.className = 'app-processing';
  overlay.hidden = true;
  overlay.innerHTML = '<div class="app-processing-card" role="status" aria-live="polite"><span class="app-processing-spinner" aria-hidden="true"></span><strong></strong><p></p></div>';
  document.body.append(overlay);
  return overlay;
}

function setOverlay(options = {}) {
  const node = ensure();
  node.querySelector('strong').textContent = options.title || 'Processing…';
  node.querySelector('p').textContent = options.message || '';
  node.style.pointerEvents = 'auto';
  node.hidden = false;
}

function hideOverlay() {
  if (!overlay) return;
  overlay.hidden = true;
  overlay.style.pointerEvents = 'none';
}

function operationLabel(options = {}) { return options.label || options.title || 'Processing'; }
function log(event, label) { console.info(`[PROCESSING] ${event}`, { count: operations.size, label }); }

export function startProcessing(options = {}) {
  const token = `processing-${++nextOperationId}`;
  const entry = { options, label: operationLabel(options) };
  operations.set(token, entry);
  setOverlay(options);
  log('START', entry.label);
  return token;
}

export function stopProcessing(token) {
  const entry = operations.get(token);
  if (!entry) return;
  operations.delete(token);
  log('STOP', entry.label);
  if (!operations.size) hideOverlay();
  else setOverlay([...operations.values()].at(-1).options);
}

export function updateProcessing(token, options = {}) {
  const entry = operations.get(token);
  if (!entry) return;
  entry.options = { ...entry.options, ...options };
  entry.label = operationLabel(entry.options);
  setOverlay(entry.options);
}

export function clearProcessing(label = 'navigation') {
  operations.clear();
  hideOverlay();
  log('CLEAR', label);
}

export function isProcessing() { return operations.size > 0; }
export function processingCount() { return operations.size; }

// Names retained for existing callers while every caller migrates to owned tokens.
export const showProcessing = startProcessing;
export const hideProcessing = stopProcessing;

if (typeof document !== 'undefined') {
  document.addEventListener('workspace:changed', () => clearProcessing('workspace navigation'));
  window.addEventListener('pagehide', () => clearProcessing('pagehide'));
}