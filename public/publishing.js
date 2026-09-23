import { loadCalendarAsset } from '/src/calendar-assets.js';
import { previewPngBlob } from '/src/export.js';

const state = {
  media: null,
  uploaded: null,
  generatedRef: null,
  generatedPreview: null,
  mediaSource: 'none',
  existingMedia: null,
  channels: new Set(),
  channelLabels: new Map(),
  busy: false
};

const q = (id) => document.getElementById(id);
const caption = q('publishing-caption');
const out = q('publishing-result');
const button = q('publishing-prepare');
const mediaInput = q('publishing-media-input');
const mediaTrigger = q('publishing-media-trigger');
const mediaBadge = q('publishing-media-badge');
const modeSelect = q('publishing-mode');

q('publishing-timezone').textContent = `Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;

function channelLabel(channel) {
  const service = String(channel.service || 'Channel');
  const serviceName = service.charAt(0).toUpperCase() + service.slice(1);
  return `${serviceName} — ${channel.name || 'Connected channel'}`;
}

function setMediaState(source, message = 'Text-only post') {
  state.mediaSource = source;
  const labels = { manual: 'Uploaded media', generated: 'Generated design', 'existing-url': 'Existing media' };
  const label = labels[source];
  mediaBadge.hidden = !label;
  mediaBadge.textContent = label || '';
  mediaTrigger.textContent = source === 'none' ? 'Add media' : 'Replace media';
  if (source === 'none') q('publishing-media').textContent = message;
}

function syncModeControl() {
  const schedule = modeSelect.value === 'schedule';
  q('publishing-schedule').hidden = !schedule;
  button.textContent = schedule ? 'Schedule Post' : 'Publish Now';
  document.querySelectorAll('[data-publishing-mode]').forEach((control) => {
    const active = control.dataset.publishingMode === modeSelect.value;
    control.classList.toggle('active', active);
    control.setAttribute('aria-pressed', String(active));
  });
}

async function loadChannels() {
  try {
    const response = await fetch('/api/buffer/channels');
    const data = await response.json();
    if (!response.ok) throw new Error('Channel loading failed');

    const channels = data.channels || [];
    q('publishing-status').textContent = `${channels.length} channel${channels.length === 1 ? '' : 's'} connected`;
    state.channelLabels.clear();
    q('publishing-channels').replaceChildren(...channels.map((channel) => {
      const row = document.createElement('label');
      const input = document.createElement('input');
      const copy = document.createElement('span');
      const service = document.createElement('strong');
      const name = document.createElement('small');

      row.className = 'publishing-channel';
      input.type = 'checkbox';
      input.value = channel.id;
      service.textContent = String(channel.service || 'Channel').replace(/^./, (letter) => letter.toUpperCase());
      name.textContent = channel.name || 'Connected channel';
      copy.append(service, name);
      input.onchange = () => input.checked ? state.channels.add(channel.id) : state.channels.delete(channel.id);
      state.channelLabels.set(channel.id, channelLabel(channel));
      row.append(input, copy);
      return row;
    }));
  } catch {
    q('publishing-status').textContent = 'Channels unavailable';
  }
}

async function uploadOnce() {
  if (state.uploaded) return state.uploaded;
  if (state.mediaSource === 'existing-url') return state.existingMedia;
  if (state.mediaSource === 'generated') {
    if (!state.generatedPreview) throw new Error('Generated design could not be loaded. Return to Design Review and regenerate it.');
    const blob = await previewPngBlob(state.generatedPreview);
    state.media = new File([blob], 'generated-design.png', { type: 'image/png' });
  }
  if (!state.media) return null;

  const form = new FormData();
  form.append('media', state.media);
  const response = await fetch('/api/media/upload', { method: 'POST', body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Media upload failed.');
  state.uploaded = data.media;
  return state.uploaded;
}

function reset() {
  state.media = null;
  state.uploaded = null;
  state.generatedRef = null;
  state.generatedPreview = null;
  state.existingMedia = null;
  state.channels.clear();
  caption.value = '';
  mediaInput.value = '';
  out.textContent = '';
  q('publishing-channels').querySelectorAll('input').forEach((input) => { input.checked = false; });
  setMediaState('none');
}

q('publishing-new').onclick = reset;
mediaTrigger.onclick = () => mediaInput.click();
modeSelect.onchange = syncModeControl;
document.querySelectorAll('[data-publishing-mode]').forEach((control) => {
  control.onclick = () => {
    modeSelect.value = control.dataset.publishingMode;
    modeSelect.dispatchEvent(new Event('change'));
  };
});

mediaInput.onchange = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  state.media = file;
  state.uploaded = null;
  state.generatedRef = null;
  state.generatedPreview = null;
  state.existingMedia = null;
  setMediaState('manual');
  const url = URL.createObjectURL(file);
  q('publishing-media').innerHTML = file.type.startsWith('video/')
    ? `<video controls src="${url}"></video>`
    : `<img src="${url}" alt="Selected media preview">`;
};

button.onclick = async () => {
  if (state.busy) return;
  if (!caption.value.trim() || !state.channels.size) {
    out.textContent = 'Add a caption and select at least one channel.';
    return;
  }

  const schedule = modeSelect.value === 'schedule';
  let dueAt;
  if (schedule) {
    const local = `${q('publishing-date').value}T${q('publishing-time').value}`;
    if (!q('publishing-date').value || !q('publishing-time').value || Number.isNaN(Date.parse(local)) || Date.parse(local) <= Date.now()) {
      out.textContent = 'Choose a future schedule date and time.';
      return;
    }
    dueAt = new Date(local).toISOString();
  }

  const confirmation = schedule
    ? `Schedule this post for ${q('publishing-date').value} ${q('publishing-time').value} on ${state.channels.size} selected channel(s)?`
    : `Publish this post to ${state.channels.size} selected channel(s) now?`;
  if (!confirm(confirmation)) return;

  state.busy = true;
  button.disabled = true;
  button.textContent = schedule ? 'Scheduling...' : 'Publishing...';
  try {
    const media = await uploadOnce();
    const response = await fetch('/api/publishing/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: caption.value,
        channelIds: [...state.channels],
        mode: schedule ? 'customScheduled' : 'shareNow',
        ...(dueAt ? { dueAt } : {}),
        ...(media ? { media } : {})
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Publishing failed.');
    out.textContent = data.results.map((result) => {
      const label = state.channelLabels.get(result.channelId) || 'Selected channel';
      return result.success
        ? `✓ ${label}\n  ${schedule ? 'Scheduled successfully' : 'Published successfully'}`
        : `✕ ${label}\n  ${result.error}`;
    }).join('\n\n');
  } catch (error) {
    out.textContent = error.message;
  } finally {
    state.busy = false;
    button.disabled = false;
    syncModeControl();
  }
};

document.addEventListener('publishing:generated', async (event) => {
  const result = event.detail;
  state.media = null;
  state.uploaded = null;
  state.generatedRef = result.resultRef;
  state.generatedPreview = null;
  state.existingMedia = null;
  mediaInput.value = '';
  caption.value = [result.headline, result.supportingCopy, result.cta].filter(Boolean).join('\n\n');

  const asset = await loadCalendarAsset(result.resultRef);
  if (!asset) {
    setMediaState('none', 'Generated design could not be loaded. Return to Design Review and regenerate it.');
    out.textContent = 'Generated design could not be loaded. Return to Design Review and regenerate it.';
  } else {
    const template = document.createElement('template');
    template.innerHTML = asset.html;
    state.generatedPreview = template.content.firstElementChild;
    q('publishing-media').replaceChildren(state.generatedPreview.cloneNode(true));
    setMediaState('generated');
    out.textContent = 'Generated design ready for publishing.';
  }
  document.dispatchEvent(new Event('navigate:publishing'));
});

syncModeControl();
loadChannels();
const management = q('publishing-management');
const composer = q('publishing-composer');
const managementList = q('publishing-management-list');
const managementStatus = q('publishing-management-status');
let managementStatusName = 'scheduled';

function localDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}

function managementMedia(post) {
  const asset = post.assets?.[0];
  const holder = document.createElement('div');
  holder.className = 'publishing-post-thumb';
  if (!asset?.url) { holder.textContent = 'Text only'; return holder; }
  const media = document.createElement(asset.resourceType === 'video' ? 'video' : 'img');
  media.src = asset.url;
  if (media.tagName === 'IMG') media.alt = 'Post media'; else media.muted = true;
  holder.append(media); return holder;
}

function scheduleAgain(post) {
  reset();
  caption.value = post.text || '';
  if (post.channelId) {
    state.channels.add(post.channelId);
    q('publishing-channels').querySelectorAll('input').forEach(input => { input.checked = input.value === post.channelId; });
  }
  const media = post.assets?.[0];
  if (media?.url) {
    state.existingMedia = media;
    state.media = null;
    state.uploaded = null;
    setMediaState('existing-url');
    const image = document.createElement(media.resourceType === 'video' ? 'video' : 'img');
    image.src = media.url;
    if (image.tagName === 'VIDEO') image.controls = true; else image.alt = 'Existing post media';
    q('publishing-media').replaceChildren(image);
  }
  showPublishingTab('composer');
}

function postCard(post) {
  const card = document.createElement('article'); card.className = 'publishing-post-card';
  const copy = document.createElement('div'); copy.className = 'publishing-post-copy';
  const label = document.createElement('small'); label.textContent = `${channelLabel({ service: post.service, name: post.channelName })} · ${localDate(post.dueAt)}`;
  const text = document.createElement('p'); text.textContent = post.text || 'No caption'; copy.append(label, text);
  const actions = document.createElement('div'); actions.className = 'publishing-post-actions';
  const again = document.createElement('button'); again.type = 'button'; again.textContent = 'Schedule Again'; again.onclick = () => scheduleAgain(post); actions.append(again);
  if (managementStatusName === 'scheduled') {
    const reschedule = document.createElement('button'); reschedule.type = 'button'; reschedule.textContent = 'Reschedule';
    reschedule.onclick = () => {
      const form = document.createElement('div'); form.className = 'publishing-reschedule';
      const date = document.createElement('input'); date.type = 'date'; const time = document.createElement('input'); time.type = 'time';
      const current = new Date(post.dueAt); if (!Number.isNaN(current.getTime())) { date.value = current.toLocaleDateString('en-CA'); time.value = current.toTimeString().slice(0, 5); }
      const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Save new time';
      save.onclick = async () => { const local = `${date.value}T${time.value}`; if (!date.value || !time.value || Number.isNaN(Date.parse(local)) || Date.parse(local) <= Date.now()) { managementStatus.textContent = 'Choose a future schedule time.'; return; } try { const response = await fetch(`/api/buffer/posts/${encodeURIComponent(post.id)}/reschedule`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dueAt: new Date(local).toISOString() }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message); managementStatus.textContent = 'Post rescheduled successfully.'; loadManagement(); } catch (error) { managementStatus.textContent = error.message || 'Buffer could not reschedule this post.'; } };
      const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Cancel'; close.onclick = () => { form.remove(); reschedule.disabled = false; };
      form.append(date, time, save, close); card.append(form); reschedule.disabled = true;
    };
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.onclick = async () => { if (!confirm('Cancel this scheduled post? It will be removed from Buffer’s queue.')) return; try { const response = await fetch(`/api/buffer/posts/${encodeURIComponent(post.id)}`, { method: 'DELETE' }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message); managementStatus.textContent = 'Scheduled post cancelled.'; loadManagement(); } catch (error) { managementStatus.textContent = error.message || 'Buffer could not cancel this post.'; } };
    actions.prepend(reschedule, cancel);
  }
  card.append(managementMedia(post), copy, actions); return card;
}

async function loadManagement() {
  managementStatus.textContent = 'Loading posts…'; managementList.replaceChildren();
  try { const response = await fetch(`/api/buffer/posts?status=${managementStatusName}`); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message); const posts = data.posts || []; managementStatus.textContent = ''; managementList.replaceChildren(...(posts.length ? posts.map(postCard) : [Object.assign(document.createElement('p'), { textContent: managementStatusName === 'scheduled' ? 'No scheduled posts yet.' : 'No published posts yet.' })])); } catch (error) { managementStatus.textContent = error.message || 'Buffer posts are unavailable.'; }
}
function showPublishingTab(tab) {
  document.querySelectorAll('[data-publishing-tab]').forEach(button => { const active = button.dataset.publishingTab === tab; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
  composer.hidden = tab !== 'composer'; management.hidden = tab === 'composer';
  if (tab !== 'composer') { managementStatusName = tab === 'scheduled' ? 'scheduled' : 'sent'; q('publishing-management-title').textContent = tab === 'scheduled' ? 'Scheduled' : 'Published'; loadManagement(); }
}
document.querySelectorAll('[data-publishing-tab]').forEach(button => { button.onclick = () => showPublishingTab(button.dataset.publishingTab); });
q('publishing-management-refresh').onclick = loadManagement;