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

const createSection =
  document.getElementById('section-create');

const brandSection =
  document.getElementById('section-brand');

const calendarSection =
  document.getElementById('section-calendar');
const reviewSection = document.getElementById('section-review');
const publishingSection = document.getElementById('section-publishing');


function showSection(section) {
  const sections = {
    create: [createButton, createSection],
    brand: [brandButton, brandSection],
    calendar: [calendarButton, calendarSection],
    review: [reviewButton, reviewSection], publishing: [publishingButton, publishingSection]
  };

  for (const [name, [button, content]] of Object.entries(sections)) {
    const active = name === section;
    content.hidden = !active;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
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
document.addEventListener('navigate:publishing', () => showSection('publishing'));
document.addEventListener('navigate:review', () => showSection('review'));
document.addEventListener('navigate:calendar', () => showSection('calendar'));
document.addEventListener('navigate:create', () => showSection('create')); 


// Start on Create Design.
showSection('create');
