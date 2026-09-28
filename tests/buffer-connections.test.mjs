import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getBufferConnections, aggregateBufferChannels, publishAcrossConnections, aggregateBufferPosts, findBufferConnection } from '../src/buffer-connections.mjs';

const connections = [{ id:'buffer-a', name:'Buffer A', apiKey:'a-secret' }, { id:'buffer-b', name:'Buffer B', apiKey:'b-secret' }];
const image = { url:'https://res.cloudinary.com/demo/image/upload/test.png', resourceType:'image', mimeType:'image/png', bytes:1200, width:1080, height:1350 };
function response(data) { return { ok:true, status:200, json:async()=>data }; }
function fetcher(_url, init) {
  const body=JSON.parse(init.body); const key=init.headers.authorization;
  if (body.query.includes('GetOrganizations')) return response({ data:{ account:{ organizations:[{id:key === 'Bearer a-secret' ? 'a-org':'b-org'}] } } });
  if (body.query.includes('GetChannels')) return response({ data:{ channels:key === 'Bearer a-secret' ? [{id:'facebook',service:'facebook',displayName:'Upplai'},{id:'linkedin',service:'linkedin',displayName:'Upplai'}] : [{id:'duplicate-facebook',service:'facebook',displayName:'Upplai'},{id:'tiktok',service:'tiktok',displayName:'Resume With Upplai'},{id:'x',service:'x',displayName:'Upplai X'}] } });
  if (body.query.includes('mutation CreatePost')) return response({ data:{ createPost:{ post:{ id:`${key}-post`,status:'sent',dueAt:null } } } });
  if (body.query.includes('query Posts')) return response({ data:{ posts:{ edges:[{node:{id:`${key}-scheduled`,text:'Post',status:'scheduled',dueAt:'2030-01-01T10:00:00Z',channel:{id:'channel',service:'linkedin',displayName:'Upplai'},assets:[]}}]}} });
  throw new Error('Unexpected request');
}

test('legacy and JSON Buffer connection configuration are safe and credential-free', () => {
  assert.deepEqual(getBufferConnections({ BUFFER_API_KEY:'legacy-secret' }).map(({id,name})=>({id,name})),[{id:'legacy',name:'Buffer'}]);
  const parsed=getBufferConnections({ BUFFER_CONNECTIONS_JSON:JSON.stringify(connections) });
  assert.equal(parsed.length,2); assert.throws(()=>getBufferConnections({ BUFFER_CONNECTIONS_JSON:'{' }),/valid JSON/);
  assert.doesNotMatch(JSON.stringify(parsed.map(({id,name})=>({id,name}))),/secret/);
});

test('channels aggregate by connection, retain composite identity, isolate failures, and hide duplicates', async () => {
  const result=await aggregateBufferChannels({ connections, fetcher });
  assert.deepEqual(result.channels.map(channel=>channel.destinationId),['buffer-a:facebook','buffer-a:linkedin','buffer-b:tiktok','buffer-b:x']);
  assert.equal(result.duplicates.length,1); assert.equal(result.duplicates[0].channelId,'duplicate-facebook');
  const partial=await aggregateBufferChannels({ connections, fetcher:async (url, init)=>init.headers.authorization==='Bearer a-secret' ? fetcher(url,init) : Promise.reject(new Error('bad')) });
  assert.equal(partial.channels.length,2); assert.equal(partial.connections.find(item=>item.id==='buffer-b').status,'error');
});

test('mixed publish routes each destination to its owning connection and preserves per-channel results', async () => {
  const results=await publishAcrossConnections({ connections, destinations:[{connectionId:'buffer-a',channelId:'facebook'},{connectionId:'buffer-b',channelId:'tiktok'}], text:'Caption', mode:'shareNow', media:image, fetcher, mediaVerifier:async media=>({ready:true,media}) });
  assert.deepEqual(results.map(item=>item.connectionId),['buffer-a','buffer-b']); assert.equal(results.every(item=>item.success),true);
});

test('scheduled posts aggregate with their owning connection identity', async () => {
  const result=await aggregateBufferPosts({ connections, status:'scheduled', fetcher });
  assert.deepEqual(result.posts.map(post=>post.connectionId),['buffer-a','buffer-b']); assert.equal(result.errors.length,0);
});
test('management routing resolves only the owning connection', () => {
  assert.equal(findBufferConnection(connections, 'buffer-b').apiKey, 'b-secret');
  assert.throws(() => findBufferConnection(connections, 'missing'), /unavailable/);
});
test('Publishing multi-connection markup and initialization guards cannot leave a permanent loading state', async () => {
  const [html, publishing] = await Promise.all([
    fs.promises.readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    fs.promises.readFile(new URL('../public/publishing.js', import.meta.url), 'utf8')
  ]);
  assert.match(html, /id="publishing-connections"/);
  assert.match(publishing, /function channelKey\(channel\).*String\(channel\.connectionId/s);
  assert.match(publishing, /Unable to load connected channels\./);
  assert.match(publishing, /Connection error\. Retry channel loading to continue\./);
});