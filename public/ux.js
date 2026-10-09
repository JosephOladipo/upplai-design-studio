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
const generator = $('generator');
if (generator && !$('create-advanced-controls')) {
  const nodes = ['background-controls','minimal-controls','free-controls','ai-controls'].map($).filter(Boolean);
  const logoRow = $('logo')?.closest('.form-row'); if (logoRow) nodes.push(logoRow);
  if (nodes.length) { const detail = document.createElement('details'); detail.id = 'create-advanced-controls'; detail.className = 'ux-disclosure create-advanced-controls'; const summary = document.createElement('summary'); summary.textContent = 'Advanced Design Controls'; detail.append(summary); generator.insertBefore(detail, nodes[0]); nodes.forEach(node => detail.append(node)); rememberDetails(detail); }
}
document.querySelectorAll('details').forEach(detail => { if (detail.id) rememberDetails(detail); });
const more = $('mobile-more-menu'), moreToggle = $('mobile-more-toggle');
moreToggle?.addEventListener('click', () => { const open = more.hidden; more.hidden = !open; moreToggle.setAttribute('aria-expanded', String(open)); });
function navigateWorkspace(workspace) { document.dispatchEvent(new CustomEvent('navigate:workspace', { detail: { workspace } })); if (more) more.hidden = true; moreToggle?.setAttribute('aria-expanded', 'false'); }
document.querySelectorAll('[data-mobile-workspace]').forEach(button => button.addEventListener('click', () => navigateWorkspace(button.dataset.mobileWorkspace)));
document.addEventListener('workspace:changed', event => { const workspace = event.detail?.workspace; document.querySelectorAll('[data-mobile-workspace]').forEach(button => button.classList.toggle('active', button.dataset.mobileWorkspace === workspace)); });
const createWorkspace = $('section-create');
function setCreateView(view) { if (!createWorkspace) return; createWorkspace.dataset.mobileView = view; document.querySelectorAll('[data-create-view]').forEach(button => { const active = button.dataset.createView === view; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); }); }
document.querySelectorAll('[data-create-view]').forEach(button => button.addEventListener('click', () => setCreateView(button.dataset.createView)));
setCreateView('edit');
document.querySelectorAll('[data-home-workspace]').forEach(button => button.addEventListener('click', () => navigateWorkspace(button.dataset.homeWorkspace)));
document.querySelectorAll('[data-home-create]').forEach(button => button.addEventListener('click', () => { navigateWorkspace('create'); document.querySelector(`[data-content-type="${button.dataset.homeCreate}"]`)?.click(); setCreateView('edit'); }));
