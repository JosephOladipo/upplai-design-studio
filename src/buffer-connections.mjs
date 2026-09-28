import { BufferError, getBufferChannels, getBufferOrganizations } from './buffer.mjs';
import { publishPosts } from './buffer-publish.mjs';
import { listBufferPosts } from './buffer-posts.mjs';

const clean = value => String(value || '').trim();
const safeName = (value, fallback) => clean(value).slice(0, 80) || fallback;
const destinationKey = (connectionId, channelId) => `${connectionId}:${channelId}`;

export function getBufferConnections(env = process.env) {
  const raw = clean(env.BUFFER_CONNECTIONS_JSON);
  if (raw) {
    let parsed;
    try { parsed = JSON.parse(raw.replace(/\r?\n/g, '')); } catch { throw new BufferError('CONFIGURATION', 'BUFFER_CONNECTIONS_JSON is not valid JSON.'); }
    if (!Array.isArray(parsed) || !parsed.length) throw new BufferError('CONFIGURATION', 'BUFFER_CONNECTIONS_JSON must contain at least one connection.');
    const ids = new Set();
    const connections = parsed.map((item, index) => {
      const id = clean(item?.id);
      const apiKey = clean(item?.apiKey);
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || !apiKey || ids.has(id)) throw new BufferError('CONFIGURATION', 'Each Buffer connection needs a unique id and API key.');
      ids.add(id);
      return { id, name: safeName(item?.name, `Buffer connection ${index + 1}`), apiKey };
    });
    return connections;
  }
  if (clean(env.BUFFER_API_KEY)) return [{ id: 'legacy', name: 'Buffer', apiKey: clean(env.BUFFER_API_KEY) }];
  throw new BufferError('NOT_CONFIGURED', 'Buffer is not configured on this server.');
}

export const safeConnection = ({ id, name }, status = 'connected', channelCount = 0, error = '') => ({ id, name, status, channelCount, ...(error ? { error } : {}) });

export async function aggregateBufferChannels({ connections = getBufferConnections(), fetcher } = {}) {
  const settled = await Promise.allSettled(connections.map(async connection => ({ connection, channels: await getBufferChannels({ apiKey: connection.apiKey, fetcher }) })));
  const statuses = []; const channels = []; const duplicates = []; const seen = new Set();
  settled.forEach((result, index) => {
    const connection = connections[index];
    if (result.status === 'rejected') { statuses.push(safeConnection(connection, 'error', 0, 'Connection error')); return; }
    const rows = result.value.channels;
    statuses.push(safeConnection(connection, 'connected', rows.length));
    rows.forEach(channel => {
      const duplicateKey = `${String(channel.service || '').toLowerCase()}|${String(channel.name || '').trim().toLowerCase()}`;
      if (duplicateKey && seen.has(duplicateKey)) { duplicates.push({ connectionId: connection.id, channelId: channel.id, service: channel.service, name: channel.name }); return; }
      seen.add(duplicateKey);
      channels.push({ ...channel, connectionId: connection.id, connectionName: connection.name, destinationId: destinationKey(connection.id, channel.id) });
    });
  });
  return { connections: statuses, channels, duplicates };
}

export async function publishAcrossConnections({ connections = getBufferConnections(), destinations = [], text, channelTexts = {}, tiktokTitle = '', mode, dueAt, media, fetcher, mediaVerifier } = {}) {
  const map = new Map(connections.map(connection => [connection.id, connection]));
  const groups = new Map(); const results = [];
  for (const destination of destinations) {
    const connectionId = clean(destination?.connectionId); const channelId = clean(destination?.channelId);
    if (!map.has(connectionId) || !channelId) { results.push({ connectionId, channelId, success: false, error: 'Selected channel is unavailable.' }); continue; }
    const list = groups.get(connectionId) || []; list.push(channelId); groups.set(connectionId, list);
  }
  for (const [connectionId, channelIds] of groups) {
    const connection = map.get(connectionId);
    const perConnectionText = Object.fromEntries(channelIds.map(channelId => [channelId, channelTexts[destinationKey(connectionId, channelId)] || channelTexts[channelId] || text]));
    try {
      const groupResults = await publishPosts({ apiKey: connection.apiKey, text, channelTexts: perConnectionText, tiktokTitle, channelIds, mode, dueAt, media, fetcher, mediaVerifier });
      results.push(...groupResults.map(result => ({ ...result, connectionId, connectionName: connection.name })));
    } catch (error) { results.push(...channelIds.map(channelId => ({ connectionId, connectionName: connection.name, channelId, success: false, error: error?.message || 'Buffer connection failed.' }))); }
  }
  return results;
}

export async function aggregateBufferPosts({ connections = getBufferConnections(), status, fetcher } = {}) {
  const settled = await Promise.allSettled(connections.map(async connection => {
    const organizations = await getBufferOrganizations({ apiKey: connection.apiKey, fetcher });
    const posts = await listBufferPosts({ apiKey: connection.apiKey, status, organizationIds: organizations.map(item => item.id), fetcher });
    return { connection, posts };
  }));
  const errors = []; const posts = [];
  settled.forEach((result, index) => {
    const connection = connections[index];
    if (result.status === 'rejected') { errors.push(safeConnection(connection, 'error', 0, 'Connection error')); return; }
    posts.push(...result.value.posts.map(post => ({ ...post, connectionId: connection.id, connectionName: connection.name })));
  });
  posts.sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0));
  return { posts, errors };
}

export function findBufferConnection(connections, connectionId) {
  const connection = connections.find(item => item.id === connectionId);
  if (!connection) throw new BufferError('NOT_FOUND', 'This Buffer connection is unavailable.');
  return connection;
}