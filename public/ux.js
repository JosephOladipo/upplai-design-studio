const $ = id => document.getElementById(id);
const key = 'upplai-design-studio-disclosures';
function rememberDetails(detail) { try { const saved = JSON.parse(sessionStorage.getItem(key) || '{}'); detail.open = saved[detail.id] ?? detail.open; detail.addEventListener('toggle', () => { saved[detail.id] = detail.open; sessionStorage.setItem(key, JSON.stringify(saved)); }); } catch {} }
function disclosure(id, summary, nodes) { const first = nodes.find(Boolean); if (!first || $(id)) return; const detail = document.createElement('details'); detail.id = id; detail.className = 'ux-disclosure'; const label = document.createElement('summary'); label.textContent = summary; detail.append(label); const host = first.closest('#ai-designer-panel') || first.parentElement; host.insertBefore(detail, first); nodes.filter(Boolean).forEach(node => detail.append(node)); rememberDetails(detail); }
// Keep the important copy inputs visible; put secondary AI Designer choices behind named, accessible disclosures.
const designer = $('ai-designer-panel');
if (designer) {
  disclosure('ai-designer-reference-settings', 'Reference settings', [$('ai-designer-reference')?.parentElement, $('ai-designer-reference-preview'), $('ai-designer-reference-usage')?.parentElement]);
  disclosure('ai-designer-text-settings', 'Text & typography', [$('ai-designer-text-mode')?.parentElement, $('ai-designer-font-style')?.parentElement]);
  disclosure('ai-designer-rewrite-settings', 'CTA & rewrite', [$('ai-designer-cta')?.parentElement, $('ai-designer-rewrite')?.parentElement, $('ai-designer-page-count')?.parentElement]);
}
document.querySelectorAll('details').forEach(detail => { if (detail.id) rememberDetails(detail); });
const more = $('mobile-more-menu'), moreToggle = $('mobile-more-toggle');
moreToggle?.addEventListener('click', () => { const open = more.hidden; more.hidden = !open; moreToggle.setAttribute('aria-expanded', String(open)); });
document.querySelectorAll('[data-mobile-workspace]').forEach(button => button.addEventListener('click', () => { const id = `nav-${button.dataset.mobileWorkspace}`; $(id)?.click(); if (more) more.hidden = true; moreToggle?.setAttribute('aria-expanded', 'false'); }));
document.addEventListener('workspace:changed', event => { const workspace = event.detail?.workspace; document.querySelectorAll('[data-mobile-workspace]').forEach(button => button.classList.toggle('active', button.dataset.mobileWorkspace === workspace)); });
