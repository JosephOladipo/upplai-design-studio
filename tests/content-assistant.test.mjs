import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCaptionOptions, generateAltText, normalizeAssistantInput } from '../src/content-assistant.mjs';
import { publishPosts } from '../src/buffer-publish.mjs';
import { createRequire } from 'node:module';

const config = { mockMode: true, apiKey: '' };
const input = { sourceCaption: 'Practical interview preparation tips.', instruction: 'Keep it professional.', controls: { tone: 'professional', length: 'short', hashtags: 'few' }, context: { headline: 'Interview preparation', supportingCopy: 'Prepare a clear answer.', cta: 'Learn more', brand: { name: 'Upplai' } } };

test('caption assistant returns exactly three grounded generic options in Mock Mode', async () => {
  const result = await generateCaptionOptions({ config, input });
  assert.equal(result.options.length, 3);
  assert.deepEqual(result.options.map(option => option.id), ['concise', 'value-driven', 'conversational']);
  assert.match(result.options[0].text, /interview/i);
});

test('caption assistant batches exactly three alternatives for each selected platform', async () => {
  const result = await generateCaptionOptions({ config, input: { ...input, mode: 'platform', platforms: [{ id: 'linkedin', service: 'linkedin' }, { id: 'facebook', service: 'facebook' }] } });
  assert.equal(result.platformCaptions.linkedin.length, 3);
  assert.equal(result.platformCaptions.facebook.length, 3);
});

test('carousel alt text retains slide order and uses per-slide context', async () => {
  const result = await generateAltText({ config, input: { ...input, context: { ...input.context, carousel: { title: 'Career guide', slides: [{ headline: 'Prepare', body: 'Research the company.' }, { headline: 'Practice', body: 'Rehearse concise answers.' }] } } } });
  assert.equal(result.slideAltText.length, 2);
  assert.match(result.slideAltText[0], /Prepare/i);
  assert.match(result.slideAltText[1], /Practice/i);
});

test('assistant input strips excessive and malformed values safely', () => {
  const normalized = normalizeAssistantInput({ instruction: 'x'.repeat(700), controls: { tone: 'unknown', length: 'invalid', hashtags: 'none' }, platforms: [{ id: 'a', service: 'linkedin' }] });
  assert.equal(normalized.instruction.length, 600);
  assert.equal(normalized.controls.length, 'medium');
  assert.equal(normalized.platforms.length, 1);
});

test('live caption requests send attached media as vision input and retain structured context', async () => {
  let request;
  const client = { responses: { create: async value => { request = value; return { output_text: JSON.stringify({ options: [{ id: 'concise', label: 'Concise', text: 'Visible post.' }, { id: 'value-driven', label: 'Value', text: 'Visible post value.' }, { id: 'conversational', label: 'Conversation', text: 'Visible post conversation.' }] }) }; } } };
  await generateCaptionOptions({ config: { mockMode: false, designModel: 'test' }, client, input: { ...input, media: { kind: 'images', images: ['data:image/png;base64,aGVsbG8='] } } });
  assert.equal(request.input[0].content[1].type, 'input_image');
  assert.match(request.input[0].content[0].text, /Interview preparation/);
  assert.match(request.instructions, /primary source of truth/);
  assert.deepEqual(request.text, { format: { type: 'json_object' } });
});

test('video-frame analysis states its real limitation in the request', async () => {
  let request;
  const client = { responses: { create: async value => { request = value; return { output_text: JSON.stringify({ altText: 'A visible video frame.' }) }; } } };
  await generateAltText({ config: { mockMode: false, designModel: 'test' }, client, input: { ...input, media: { kind: 'video-frame', images: ['data:image/jpeg;base64,aGVsbG8='] } } });
  assert.match(request.input[0].content[0].text, /Sampled video frame only/);
  assert.deepEqual(request.text, { format: { type: 'json_object' } });
});

test('platform-specific Buffer text maps to its matching channel while legacy text remains compatible', async () => {
  const sent = [];
  const fetcher = async (_url, request) => {
    const body = JSON.parse(request.body); sent.push(body);
    if (body.query.includes('GetOrganizations')) return { ok: true, status: 200, json: async () => ({ data: { account: { organizations: [{ id: 'org' }] } } }) };
    if (body.query.includes('GetChannels')) return { ok: true, status: 200, json: async () => ({ data: { channels: [{ id: 'linkedin', service: 'linkedin', name: 'LinkedIn' }, { id: 'facebook', service: 'facebook', name: 'Facebook' }] } }) };
    return { ok: true, status: 200, json: async () => ({ data: { createPost: { post: { id: String(sent.length), status: 'sent', dueAt: null } } } }) };
  };
  await publishPosts({ apiKey: 'test', text: 'Generic caption', channelTexts: { linkedin: 'LinkedIn caption', facebook: 'Facebook caption' }, channelIds: ['linkedin', 'facebook'], mode: 'shareNow', fetcher });
  const creates = sent.filter(item => item.variables?.input);
  assert.equal(creates[0].variables.input.text, 'LinkedIn caption');
  assert.equal(creates[1].variables.input.text, 'Facebook caption');
});

test('Buffer sends an ordered carousel asset list as one post per selected channel', async () => {
  const sent = [];
  const fetcher = async (_url, request) => {
    const body = JSON.parse(request.body); sent.push(body);
    if (body.query.includes('GetOrganizations')) return { ok: true, status: 200, json: async () => ({ data: { account: { organizations: [{ id: 'org' }] } } }) };
    if (body.query.includes('GetChannels')) return { ok: true, status: 200, json: async () => ({ data: { channels: [{ id: 'facebook', service: 'facebook', name: 'Facebook' }, { id: 'linkedin', service: 'linkedin', name: 'LinkedIn' }] } }) };
    return { ok: true, status: 200, json: async () => ({ data: { createPost: { post: { id: String(sent.length), status: 'sent', dueAt: null } } } }) };
  };
  await publishPosts({ apiKey: 'test', text: 'Carousel caption', channelIds: ['facebook', 'linkedin'], mode: 'shareNow', media: { type: 'carousel', items: [{ url: 'https://cdn.test/1.png', resourceType: 'image', slideIndex: 0 }, { url: 'https://cdn.test/2.png', resourceType: 'image', slideIndex: 1 }] }, fetcher });
  const creates = sent.filter(item => item.variables?.input);
  assert.deepEqual(creates[0].variables.input.assets.map(asset => asset.image.url), ['https://cdn.test/1.png', 'https://cdn.test/2.png']);
  assert.equal(creates[0].variables.input.metadata.facebook.type, 'post');
  assert.equal(creates[1].variables.input.metadata, undefined);
});

test('Buffer adds image alt text only for platforms that support it', async () => {
  const sent = [];
  const fetcher = async (_url, request) => { const body = JSON.parse(request.body); sent.push(body); if (body.query.includes('GetOrganizations')) return { ok: true, status: 200, json: async () => ({ data: { account: { organizations: [{ id: 'org' }] } } }) }; if (body.query.includes('GetChannels')) return { ok: true, status: 200, json: async () => ({ data: { channels: [{ id: 'linkedin', service: 'linkedin', name: 'LinkedIn' }, { id: 'tiktok', service: 'tiktok', name: 'TikTok' }] } }) }; return { ok: true, status: 200, json: async () => ({ data: { createPost: { post: { id: 'post', status: 'sent' } } } }) }; };
  await publishPosts({ apiKey: 'test', text: 'Caption', channelIds: ['linkedin', 'tiktok'], mode: 'shareNow', media: { url: 'https://cdn.test/image.png', resourceType: 'image' }, accessibility: { genericAltText: 'A blue Upplai graphic.' }, fetcher, mediaVerifier: async media => ({ ready: true, media }) });
  const creates = sent.filter(item => item.variables?.input);
  assert.equal(creates[0].variables.input.assets[0].image.metadata.altText, 'A blue Upplai graphic.');
  assert.equal(creates[1].variables.input.assets[0].image.metadata, undefined);
});

test('caption and alt-text API routes work in Mock Mode without exposing credentials', async () => {
  process.env.OPENAI_MOCK_MODE = 'true';
  const app = createRequire(import.meta.url)('../server.js');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const root = `http://127.0.0.1:${server.address().port}`;
  try {
    const post = (path, body) => fetch(root + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const captions = await (await post('/api/ai/generate-caption', input)).json();
    assert.equal(captions.options.length, 3);
    const alt = await (await post('/api/ai/generate-alt-text', input)).json();
    assert.match(alt.altText, /interview/i);
    assert.equal('apiKey' in captions, false);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
