import test from 'node:test';
import assert from 'node:assert/strict';
import { listBufferPosts, rescheduleBufferPost, deleteBufferPost } from '../src/buffer-posts.mjs';

const postsFetcher = async (_url, init) => {
  const { query, variables } = JSON.parse(init.body);
  if (query.includes('query Posts')) return { ok: true, json: async () => ({ data: { posts: { edges: [{ node: { id: 'p1', text: 'Hello', status: 'scheduled', dueAt: '2030-01-01T10:00:00Z', channel: { id: 'c1', displayName: 'Upplai', service: 'facebook' }, assets: [{ __typename: 'ImageAsset', type: 'image', source: 'https://media.example/a.png', thumbnail: 'https://media.example/a-thumb.png', mimeType: 'image/png' }] } }] } } }) };
  return { ok: true, json: async () => ({ data: query.includes('editPost') ? { editPost: { __typename: 'PostActionSuccess' } } : { deletePost: { __typename: 'PostActionSuccess' } } }) };
};
test('Buffer post management normalizes scheduled posts and existing media', async () => {
  const posts = await listBufferPosts({ apiKey: 'secret', status: 'scheduled', organizationIds: ['org'], fetcher: postsFetcher });
  assert.deepEqual(posts, [{ id: 'p1', channelId: 'c1', channelName: 'Upplai', service: 'facebook', text: 'Hello', status: 'scheduled', dueAt: '2030-01-01T10:00:00Z', assets: [{ url: 'https://media.example/a.png', resourceType: 'image' }] }]);
});
test('Buffer reschedule and delete use safe supported post inputs', async () => {
  const calls = []; const fetcher = async (url, init) => { calls.push(JSON.parse(init.body)); return postsFetcher(url, init); };
  await rescheduleBufferPost({ apiKey: 'secret', id: 'p1', dueAt: '2030-01-01T10:00:00Z', fetcher });
  await deleteBufferPost({ apiKey: 'secret', id: 'p1', fetcher });
  assert.deepEqual(calls[0].variables.input, { id: 'p1', dueAt: '2030-01-01T10:00:00Z' });
  assert.deepEqual(calls[1].variables.input, { id: 'p1' });
  assert.doesNotMatch(JSON.stringify(calls), /secret/);
});
test('Buffer post management surfaces mutation failures safely', async () => {
  const fetcher = async () => ({ ok: true, json: async () => ({ data: { deletePost: { __typename: 'MutationError', message: 'Not available' } } }) });
  await assert.rejects(() => deleteBufferPost({ apiKey: 'secret', id: 'p1', fetcher }), /Not available/);
});
test('Buffer post management returns published posts with sent time and ignores other statuses', async () => {
  const fetcher = async () => ({ ok: true, json: async () => ({ data: { posts: { edges: [
    { node: { id: 'sent-1', text: 'Published', status: 'sent', sentAt: '2030-01-02T10:00:00Z', channel: { id: 'linkedin', name: 'Upplai', service: 'linkedin' }, assets: [{ __typename: 'VideoAsset', type: 'video', source: 'https://media.example/a.mp4', thumbnail: 'https://media.example/a-thumb.jpg', mimeType: 'video/mp4' }] } },
    { node: { id: 'draft-1', text: 'Draft', status: 'draft', channel: { id: 'linkedin', name: 'Upplai', service: 'linkedin' }, assets: [] } }
  ] } } }) });
  const posts = await listBufferPosts({ apiKey: 'secret', status: 'sent', organizationIds: ['org'], fetcher });
  assert.deepEqual(posts, [{ id: 'sent-1', channelId: 'linkedin', channelName: 'Upplai', service: 'linkedin', text: 'Published', status: 'sent', dueAt: '2030-01-02T10:00:00Z', assets: [{ url: 'https://media.example/a.mp4', resourceType: 'video' }] }]);
});
test('Buffer post management keeps posts without media and uses a thumbnail when source is absent', async () => {
  const fetcher = async () => ({ ok: true, json: async () => ({ data: { posts: { edges: [
    { node: { id: 'text-only', text: 'No media', status: 'scheduled', dueAt: '2030-01-03T10:00:00Z', channel: { id: 'c1', name: 'Upplai', service: 'facebook' }, assets: [] } },
    { node: { id: 'thumbnail-only', text: 'Fallback', status: 'scheduled', dueAt: '2030-01-04T10:00:00Z', channel: { id: 'c2', name: 'Upplai', service: 'linkedin' }, assets: [{ __typename: 'ImageAsset', type: 'image', thumbnail: 'https://media.example/thumb.png', mimeType: 'image/png' }] } }
  ] } } }) });
  const posts = await listBufferPosts({ apiKey: 'secret', status: 'scheduled', organizationIds: ['org'], fetcher });
  assert.deepEqual(posts.map(post => post.assets), [[], [{ url: 'https://media.example/thumb.png', resourceType: 'image' }]]);
});