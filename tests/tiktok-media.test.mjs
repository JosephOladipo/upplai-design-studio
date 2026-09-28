import test from 'node:test';
import assert from 'node:assert/strict';
import { publishPosts, validateTikTokMedia, buildInstagramPostInput, buildTikTokPostInput, normalizeTikTokTitle } from '../src/buffer-publish.mjs';
import { verifyHostedMedia } from '../src/cloudinary.mjs';
import fs from 'node:fs';

const channels = [{ id: 'instagram-id', service: 'instagram', name: 'Instagram' }, { id: 'tiktok-id', service: 'tiktok', name: 'TikTok' }, { id: 'linkedin-id', service: 'linkedin', name: 'LinkedIn' }];
const image = { url: 'https://res.cloudinary.com/demo/image/upload/v1/design.png', resourceType: 'image', mimeType: 'image/png', bytes: 1200, width: 1080, height: 1350 };
const video = { url: 'https://res.cloudinary.com/demo/video/upload/v1/clip.mp4', resourceType: 'video', mimeType: 'video/mp4', bytes: 2400, width: 1080, height: 1920 };
const readyMedia = async media => ({ ready: true, media });
function fetcher(seen) { return async (_url, request) => { const body = JSON.parse(request.body); if (body.query.includes('GetOrganizations')) return { ok: true, status: 200, json: async () => ({ data: { account: { organizations: [{ id: 'org' }] } } }) }; if (body.query.includes('GetChannels')) return { ok: true, status: 200, json: async () => ({ data: { channels } }) }; seen.push(body.variables.input); return { ok: true, status: 200, json: async () => ({ data: { createPost: { post: { id: 'post', status: 'sent', dueAt: null } } } }) }; }; }

test('TikTok image post uses a public image asset and Buffer photo-post metadata', async () => {
  const seen=[]; const result=await publishPosts({ apiKey:'test', text:'TikTok media test', channelIds:['tiktok-id'], mode:'shareNow', media:image, fetcher:fetcher(seen), mediaVerifier:readyMedia });
  const input=seen.at(-1); assert.equal(result[0].success,true); assert.deepEqual(input.assets,[{image:{url:image.url}}]); assert.deepEqual(input.metadata,{tiktok:{title:'TikTok media test'}}); assert.equal('type' in input.metadata.tiktok, false);
});

test('Instagram static image uses the required feed-post metadata in the Buffer metadata field', async () => {
  const seen=[]; const result=await publishPosts({ apiKey:'test', text:'Instagram image', channelIds:['instagram-id'], mode:'shareNow', media:image, fetcher:fetcher(seen), mediaVerifier:readyMedia });
  const input=seen.at(-1); assert.equal(result[0].success,true); assert.deepEqual(input.assets,[{image:{url:image.url}}]); assert.deepEqual(input.metadata,{instagram:{type:'post',shouldShareToFeed:true}});
});

test('TikTok titles use the supplied headline while captions remain untruncated', async () => {
  const headline = 'A concise design headline'; const caption = 'This deliberately long TikTok caption remains the full post text. '.repeat(4);
  const seen=[]; await publishPosts({ apiKey:'test', text:caption, tiktokTitle:headline, channelIds:['tiktok-id'], mode:'shareNow', media:image, fetcher:fetcher(seen), mediaVerifier:readyMedia });
  assert.equal(seen.at(-1).text, caption); assert.equal(seen.at(-1).metadata.tiktok.title, headline);
});

test('TikTok title normalization collapses whitespace, preserves 90 characters, and truncates at a word boundary', () => {
  assert.equal(normalizeTikTokTitle('  A\n concise   title  '), 'A concise title');
  assert.equal(normalizeTikTokTitle('a'.repeat(90)).length, 90);
  const title = normalizeTikTokTitle('One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen');
  assert.ok(title.length <= 90); assert.notEqual(title.at(-1), ' ');
  assert.equal(normalizeTikTokTitle('', ''), 'Upplai post');
});
test('TikTok video sends a video asset without the rejected photo-post type or title', () => {
  assert.deepEqual(buildTikTokPostInput(video, 'Video title'), { tiktok: {} });
  assert.deepEqual(buildInstagramPostInput(image), { instagram: { type: 'post', shouldShareToFeed: true } });
});
test('TikTok video post uses only a video asset', async () => {
  const seen=[]; await publishPosts({ apiKey:'test', text:'Video', channelIds:['tiktok-id'], mode:'shareNow', media:video, fetcher:fetcher(seen), mediaVerifier:readyMedia });
  assert.deepEqual(seen.at(-1).assets,[{video:{url:video.url}}]);
});

test('TikTok blocks invalid, local, and unsupported multi-image media without a Buffer mutation', async () => {
  assert.equal(validateTikTokMedia({ ...image, url:'blob:abc' }).ok,false); assert.equal(validateTikTokMedia({ ...image, url:'http://localhost/test.png' }).ok,false); assert.equal(validateTikTokMedia({ type:'carousel', items:[image,image] }).ok,false);
  const seen=[]; const result=await publishPosts({ apiKey:'test', text:'No publish', channelIds:['tiktok-id'], mode:'shareNow', media:{...image,url:'data:image/png;base64,x'}, fetcher:fetcher(seen), mediaVerifier:readyMedia });
  assert.equal(result[0].success,false); assert.equal(seen.length,0);
});

test('TikTok mapping does not alter LinkedIn image payloads', async () => {
  const seen=[]; await publishPosts({ apiKey:'test', text:'LinkedIn', channelIds:['linkedin-id'], mode:'shareNow', media:image, fetcher:fetcher(seen), mediaVerifier:readyMedia });
  assert.deepEqual(seen.at(-1).assets,[{image:{url:image.url}}]); assert.equal(seen.at(-1).metadata,undefined);
});
test('TikTok hosted-media readiness accepts the expected public MIME and rejects an unresolved asset', async () => {
  const headers = value => ({ get: key => key === 'content-type' ? value : key === 'content-length' ? '1200' : null });
  assert.equal((await verifyHostedMedia(image, async () => ({ ok: true, headers: headers('image/png') }))).ready, true);
  assert.equal((await verifyHostedMedia(image, async () => ({ ok: true, headers: headers('video/mp4') }))).ready, false);
  const seen=[]; const result = await publishPosts({ apiKey:'test', text:'Unavailable', channelIds:['tiktok-id'], mode:'shareNow', media:image, fetcher:fetcher(seen), mediaVerifier:async () => ({ ready:false }) });
  assert.equal(result[0].success, false); assert.equal(seen.length, 0);
});

test('PNG export composites a transparent root onto its intended background before upload', () => {
  const source = fs.readFileSync(new URL('../src/export.js', import.meta.url), 'utf8');
  assert.match(source, /getComputedStyle\(preview\)\.backgroundColor/);
  assert.match(source, /context\.fillRect\(0,\s*0,\s*canvas\.width,\s*canvas\.height\)/);
});