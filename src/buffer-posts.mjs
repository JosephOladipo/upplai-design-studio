import { BufferError } from './buffer.mjs';

const ENDPOINT = 'https://api.buffer.com';
const safe = value => String(value || '').replace(/[\r\n]+/g, ' ').slice(0, 180);
const POSTS = `query Posts($organizationId: OrganizationId!) { posts(input: { organizationId: $organizationId }) { edges { node { id text status dueAt sentAt channel { id name displayName service } assets { __typename type source thumbnail mimeType } } } } }`;

async function request(apiKey, query, variables, fetcher = fetch) {
  if (!apiKey) throw new BufferError('NOT_CONFIGURED', 'Buffer is not configured on this server.');
  let response;
  try { response = await fetcher(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ query, variables }) }); }
  catch { throw new BufferError('NETWORK', 'Could not reach Buffer.'); }
  const body = await response.json().catch(() => ({}));
  const message = safe(body.errors?.[0]?.message || body.data?.editPost?.message || body.data?.deletePost?.message);
  if (!response.ok || body.errors?.length) throw new BufferError(response.status === 401 || response.status === 403 ? 'AUTH' : 'UPSTREAM', message || 'Buffer request failed.');
  return body.data;
}

export async function listBufferPosts({ apiKey, status, organizationIds = [], fetcher } = {}) {
  const nodes = [];
  for (const organizationId of organizationIds) {
    const data = await request(apiKey, POSTS, { organizationId }, fetcher);
    nodes.push(...(data.posts?.edges || []).map(edge => edge.node));
  }
  const wanted = status === 'scheduled' ? 'scheduled' : 'sent';
  return nodes.filter(post => post.status === wanted).map(post => ({
    id: post.id, channelId: post.channel?.id || '', channelName: post.channel?.displayName || post.channel?.name || post.channel?.service || 'Connected channel',
    service: post.channel?.service || 'channel', text: post.text || '', status: post.status, dueAt: post.dueAt || post.sentAt || null,
    assets: (post.assets || []).map(asset => ({ url: asset.source || asset.thumbnail || '', resourceType: asset.__typename === 'VideoAsset' || String(asset.type || '').toLowerCase() === 'video' ? 'video' : 'image' })).filter(asset => asset.url)
  }));
}

export async function rescheduleBufferPost({ apiKey, id, dueAt, fetcher } = {}) {
  const data = await request(apiKey, 'mutation EditPost($input: EditPostInput!) { editPost(input: $input) { __typename ... on MutationError { message } } }', { input: { id, dueAt } }, fetcher);
  const result = data.editPost;
  if (!result || result.__typename === 'MutationError') throw new BufferError('UPSTREAM', safe(result?.message) || 'Buffer could not reschedule this post.');
  return true;
}

export async function deleteBufferPost({ apiKey, id, fetcher } = {}) {
  const data = await request(apiKey, 'mutation DeletePost($input: DeletePostInput!) { deletePost(input: $input) { __typename ... on MutationError { message } } }', { input: { id } }, fetcher);
  const result = data.deletePost;
  if (!result || result.__typename === 'MutationError') throw new BufferError('UPSTREAM', safe(result?.message) || 'Buffer could not cancel this post.');
  return true;
}
