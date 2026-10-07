// Phase 8 — Studio Navigation
// Switches between the main Design Studio sections.

const createButton =
  document.getElementById('nav-create');

const brandButton =
  document.getElementById('nav-brand');

const calendarButton =
  document.getElementById('nav-calendar');
const reviewButton = document.getElementById('nav-review');
const publishingButton = document.getElementById('nav-publishing');
const reelsButton = document.getElementById('nav-reels');

const createSection =
  document.getElementById('section-create');

const brandSection =
  document.getElementById('section-brand');

const calendarSection =
  document.getElementById('section-calendar');
const reviewSection = document.getElementById('section-review');
const publishingSection = document.getElementById('section-publishing');
const reelsSection = document.getElementById('section-reels');
const WORKSPACE_KEY = 'upplai-design-studio-active-workspace';
const backButton = document.getElementById('app-back');
const mobileNavToggle = document.getElementById('mobile-nav-toggle');
let applyingHistory = false;
const validWorkspaces = new Set(['create', 'brand', 'calendar', 'review', 'publishing','reels']);


function showSection(section, { history = true } = {}) {
  section = validWorkspaces.has(section) ? section : 'create';
  const sections = {
    create: [createButton, createSection],
    brand: [brandButton, brandSection],
    calendar: [calendarButton, calendarSection],
    review: [reviewButton, reviewSection], publishing: [publishingButton, publishingSection], reels: [reelsButton, reelsSection]
  };

  for (const [name, [button, content]] of Object.entries(sections)) {
    const active = name === section;
    content.hidden = !active;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  try { localStorage.setItem(WORKSPACE_KEY, section); } catch { /* navigation remains usable without storage */ }
  document.dispatchEvent(new CustomEvent('workspace:changed', { detail: { workspace: section } }));
  document.body.classList.remove('mobile-nav-open');
  mobileNavToggle?.setAttribute('aria-expanded', 'false');
  if (history && !applyingHistory) { window.history.pushState({ workspace: section }, '', '#' + section); backButton.hidden = false; }
}


createButton.addEventListener(
  'click',
  () => showSection('create')
);


brandButton.addEventListener(
  'click',
  () => showSection('brand')
);

calendarButton.addEventListener(
  'click',
  () => showSection('calendar')
);
reviewButton.addEventListener('click', () => showSection('review'));
publishingButton.addEventListener('click', () => showSection('publishing'));
reelsButton.addEventListener('click', () => showSection('reels'));
mobileNavToggle?.addEventListener('click', () => {
  const open = document.body.classList.toggle('mobile-nav-open');
  mobileNavToggle.setAttribute('aria-expanded', String(open));
});
document.addEventListener('navigate:publishing', () => showSection('publishing'));
document.addEventListener('navigate:review', () => showSection('review'));
document.addEventListener('navigate:calendar', () => showSection('calendar'));
document.addEventListener('navigate:create', () => showSection('create'));
document.addEventListener('navigate:reels', () => showSection('reels'));
backButton.addEventListener('click', () => window.history.back());
window.addEventListener('popstate', event => { applyingHistory = true; showSection(event.state?.workspace || 'create', { history: false }); applyingHistory = false; }); 


// Restore the last valid workspace; Create is the safe fallback.
let restoredWorkspace = 'create';
try { restoredWorkspace = localStorage.getItem(WORKSPACE_KEY) || 'create'; } catch { /* use fallback */ }
window.history.replaceState({ workspace: restoredWorkspace }, '', '#' + restoredWorkspace);
showSection(restoredWorkspace, { history: false });
