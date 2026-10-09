import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { publishPosts } from '../src/buffer-publish.mjs';

const channels = [
  { id: 'linkedin', service: 'linkedin', name: 'LinkedIn' },
  { id: 'tiktok', service: 'tiktok', name: 'TikTok' }
];

const publishingFetch = sent => async (_url, request) => {
  const body = JSON.parse(request.body);
  sent.push(body);
  if (body.query.includes('GetOrganizations')) return { ok: true, status: 200, json: async () => ({ data: { account: { organizations: [{ id: 'org' }] } } }) };
  if (body.query.includes('GetChannels')) return { ok: true, status: 200, json: async () => ({ data: { channels } }) };
  return { ok: true, status: 200, json: async () => ({ data: { createPost: { post: { id: 'post', status: 'sent', dueAt: null } } } }) };
};

const postInputs = sent => sent.filter(item => item.variables?.input).map(item => item.variables.input);

test('the final supported single-image Buffer payload uses the latest manually edited alt text', async () => {
  const sent = [];
  await publishPosts({
    apiKey: 'test', text: 'Caption', channelIds: ['linkedin'], mode: 'shareNow',
    media: { url: 'https://cdn.test/image.png', resourceType: 'image' },
    accessibility: { altTextMode: 'generic', genericAltText: 'Edited description of the final image.' },
    fetcher: publishingFetch(sent)
  });
  assert.equal(postInputs(sent)[0].assets[0].image.metadata.altText, 'Edited description of the final image.');
});

test('carousel alt text remains in media order and unsupported services omit it', async () => {
  const sent = [];
  await publishPosts({
    apiKey: 'test', text: 'Caption', channelIds: ['linkedin', 'tiktok'], mode: 'shareNow',
    media: { type: 'carousel', items: [
      { url: 'https://cdn.test/slide-1.png', resourceType: 'image', slideIndex: 0 },
      { url: 'https://cdn.test/slide-2.png', resourceType: 'image', slideIndex: 1 }
    ] },
    accessibility: { altTextMode: 'generic', genericAltText: 'Fallback', carouselSlideAltText: ['First edited slide', 'Second edited slide'] },
    fetcher: publishingFetch(sent), mediaVerifier: async media => ({ ready: true, media })
  });
  const [linkedin] = postInputs(sent);
  assert.deepEqual(linkedin.assets.map(asset => asset.image.url), ['https://cdn.test/slide-1.png', 'https://cdn.test/slide-2.png']);
  assert.deepEqual(linkedin.assets.map(asset => asset.image.metadata.altText), ['First edited slide', 'Second edited slide']);
  assert.equal(postInputs(sent).length, 1, 'TikTok rejects unsupported multi-image media before a Buffer mutation');
});

test('video publishing never serializes image alt text into the final Buffer assets', async () => {
  const sent = [];
  await publishPosts({
    apiKey: 'test', text: 'Video caption', channelIds: ['linkedin'], mode: 'shareNow',
    media: { url: 'https://cdn.test/reel.mp4', resourceType: 'video', mimeType: 'video/mp4' },
    accessibility: { altTextMode: 'generic', genericAltText: 'This must not be an image metadata field.' },
    fetcher: publishingFetch(sent)
  });
  const asset = postInputs(sent)[0].assets[0];
  assert.deepEqual(asset, { video: { url: 'https://cdn.test/reel.mp4' } });
});

test('unsupported image services omit alt text cleanly', async () => {
  const sent = [];
  await publishPosts({
    apiKey: 'test', text: 'Photo caption', channelIds: ['tiktok'], mode: 'shareNow',
    media: { url: 'https://cdn.test/photo.png', resourceType: 'image', mimeType: 'image/png', width: 1080, height: 1080, bytes: 100 },
    accessibility: { altTextMode: 'generic', genericAltText: 'Do not send this to TikTok image metadata.' },
    fetcher: publishingFetch(sent), mediaVerifier: async media => ({ ready: true, media })
  });
  assert.equal(postInputs(sent)[0].assets[0].image.metadata, undefined);
});

test('Publishing persists edited alt text and retains it for a repeat Calendar or Review handoff of the same result', () => {
  const publishing = fs.readFileSync(new URL('../public/publishing.js', import.meta.url), 'utf8');
  const calendar = fs.readFileSync(new URL('../public/calendar-table.js', import.meta.url), 'utf8');
  assert.match(publishing, /platformAltText: state\.platformAltText, slideAltText: state\.slideAltText/);
  assert.match(publishing, /const preserveAltText = Boolean\(result\.resultRef && result\.resultRef === state\.generatedRef\)/);
  assert.match(publishing, /if \(!preserveAltText\) \{ altText\.value = ''; state\.platformAltText = \{\}; state\.slideAltText = \[\]; \}/);
  assert.match(publishing, /function handoffCarousel\(result\)/);
  assert.match(publishing, /syncCarouselAltText\(state\.carouselFiles\.length\)/);
  assert.match(calendar, /publishingCalendarResult\(row\)/);
});

test('Calendar and AI Designer ordered handoffs provide slide context without storing image binaries in localStorage', () => {
  const publishing = fs.readFileSync(new URL('../public/publishing.js', import.meta.url), 'utf8');
  assert.match(publishing, /result\.aiDesignerPlan\?\.slides/);
  assert.match(publishing, /result\.multiPage\?\.pages/);
  assert.match(publishing, /mediaRef: state\.mediaRef \|\| ''/);
});
