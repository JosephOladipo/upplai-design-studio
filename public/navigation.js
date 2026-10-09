// Phase 8 — Studio Navigation
// Switches between the main Design Studio sections.

const createButton =
  document.getElementById('nav-create');
const homeButton = document.getElementById('nav-home');

const brandButton =
  document.getElementById('nav-brand');

const calendarButton =
  document.getElementById('nav-calendar');
const reviewButton = document.getElementById('nav-review');
const publishingButton = document.getElementById('nav-publishing');
const reelsButton = document.getElementById('nav-reels');

const createSection =
  document.getElementById('section-create');
const homeSection = document.getElementById('section-home');

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
let activeWorkspace = 'create';
let previousWorkspace = 'create';
const validWorkspaces = new Set(['home', 'create', 'brand', 'calendar', 'review', 'publishing','reels']);


export function navigateToWorkspace(section, { history = true } = {}) {
  section = validWorkspaces.has(section) ? section : 'create';
  if (section !== activeWorkspace) previousWorkspace = activeWorkspace;
  activeWorkspace = section;
  const sections = {
    home: [homeButton, homeSection],
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

export function navigateBackFromWorkspace(fallback = 'create') {
  navigateToWorkspace(previousWorkspace || fallback);
}


createButton.addEventListener(
  'click',
  () => navigateToWorkspace('create')
);
homeButton.addEventListener('click', () => navigateToWorkspace('home'));


brandButton.addEventListener(
  'click',
  () => navigateToWorkspace('brand')
);

calendarButton.addEventListener(
  'click',
  () => navigateToWorkspace('calendar')
);
reviewButton.addEventListener('click', () => navigateToWorkspace('review'));
publishingButton.addEventListener('click', () => navigateToWorkspace('publishing'));
reelsButton.addEventListener('click', () => navigateToWorkspace('reels'));
mobileNavToggle?.addEventListener('click', () => {
  const open = document.body.classList.toggle('mobile-nav-open');
  mobileNavToggle.setAttribute('aria-expanded', String(open));
});
document.addEventListener('navigate:workspace', event => navigateToWorkspace(event.detail?.workspace));
document.addEventListener('navigate:publishing', () => navigateToWorkspace('publishing'));
document.addEventListener('navigate:review', () => navigateToWorkspace('review'));
document.addEventListener('navigate:calendar', () => navigateToWorkspace('calendar'));
document.addEventListener('navigate:create', () => navigateToWorkspace('create'));
document.addEventListener('navigate:reels', () => navigateToWorkspace('reels'));
backButton.addEventListener('click', () => window.history.back());
window.addEventListener('popstate', event => { applyingHistory = true; navigateToWorkspace(event.state?.workspace || 'create', { history: false }); applyingHistory = false; });


// Restore the last valid workspace; Create is the safe fallback.
let restoredWorkspace = 'create';
try { restoredWorkspace = localStorage.getItem(WORKSPACE_KEY) || 'create'; } catch { /* use fallback */ }
window.history.replaceState({ workspace: restoredWorkspace }, '', '#' + restoredWorkspace);
navigateToWorkspace(restoredWorkspace, { history: false });
