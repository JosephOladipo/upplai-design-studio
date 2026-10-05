import test from 'node:test';
import assert from 'node:assert/strict';
import { documentTitle, pdfFromJpegPages } from '../src/linkedin-carousel-document.mjs';
import { publishPosts } from '../src/buffer-publish.mjs';

test('three ordered carousel images produce a three-page PDF without changing their page geometry', () => {
  const pdf = pdfFromJpegPages([
    { jpeg: new Uint8Array([1, 2]), width: 1080, height: 1350 },
    { jpeg: new Uint8Array([3, 4]), width: 1200, height: 1200 },
    { jpeg: new Uint8Array([5, 6]), width: 1350, height: 1080 }
  ]);
  const source = new TextDecoder('latin1').decode(pdf);
  assert.match(source, /\/Count 3/);
  assert.match(source, /\/MediaBox \[0 0 1080 1350\][\s\S]*\/MediaBox \[0 0 1200 1200\][\s\S]*\/MediaBox \[0 0 1350 1080\]/);
  assert.match(source, /\/Im0[\s\S]*\/Im1[\s\S]*\/Im2/);
  assert.equal(documentTitle('  A useful carousel  '), 'A useful carousel');
});

test('LinkedIn receives one document asset while Instagram receives the original ordered image carousel', async () => {
  const sent = [];
  const fetcher = async (_url, request) => {
    const body = JSON.parse(request.body); sent.push(body);
    if (body.query.includes('GetOrganizations')) return { ok: true, status: 200, json: async () => ({ data: { account: { organizations: [{ id: 'org' }] } } }) };
    if (body.query.includes('GetChannels')) return { ok: true, status: 200, json: async () => ({ data: { channels: [{ id: 'linkedin', service: 'linkedin' }, { id: 'instagram', service: 'instagram' }] } }) };
    return { ok: true, status: 200, json: async () => ({ data: { createPost: { post: { id: 'post', status: 'scheduled' } } } }) };
  };
  const carousel = { type: 'carousel', items: [{ url: 'https://cdn.test/1.png', resourceType: 'image' }, { url: 'https://cdn.test/2.png', resourceType: 'image' }, { url: 'https://cdn.test/3.png', resourceType: 'image' }] };
  await publishPosts({ apiKey: 'test', text: 'Caption', channelIds: ['linkedin', 'instagram'], mode: 'customScheduled', dueAt: '2030-01-01T12:00:00.000Z', media: carousel, mediaByChannel: { linkedin: { url: 'https://cdn.test/carousel.pdf', resourceType: 'document', mimeType: 'application/pdf', title: 'Editable title', thumbnailUrl: carousel.items[0].url } }, fetcher });
  const creates = sent.filter(item => item.variables?.input);
  assert.equal(creates.length, 2);
  assert.deepEqual(creates[0].variables.input.assets, [{ document: { url: 'https://cdn.test/carousel.pdf', title: 'Editable title', thumbnailUrl: 'https://cdn.test/1.png' } }]);
  assert.deepEqual(creates[1].variables.input.assets.map(asset => asset.image.url), ['https://cdn.test/1.png', 'https://cdn.test/2.png', 'https://cdn.test/3.png']);
});
