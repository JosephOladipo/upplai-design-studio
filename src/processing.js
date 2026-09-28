let overlay;
function ensure() {
  if (overlay) return overlay;
  overlay = document.createElement('div'); overlay.className = 'app-processing'; overlay.hidden = true;
  overlay.innerHTML = '<div class="app-processing-card" role="status" aria-live="polite"><span class="app-processing-spinner" aria-hidden="true"></span><strong></strong><p></p></div>';
  document.body.append(overlay); return overlay;
}
export function showProcessing({ title = 'Processing…', message = '' } = {}) { const node = ensure(); node.querySelector('strong').textContent = title; node.querySelector('p').textContent = message; node.hidden = false; }
export function hideProcessing() { if (overlay) overlay.hidden = true; }
