const ENDPOINT = 'https://api.buffer.com';
const ORGANIZATIONS = 'query GetOrganizations { account { organizations { id } } }';
const CHANNELS = 'query GetChannels($organizationId: OrganizationId!) { channels(input: { organizationId: $organizationId }) { id name displayName service } }';
export class BufferError extends Error { constructor(code, message) { super(message); this.code = code; } }
async function request(key, query, variables, fetcher = fetch) {
  let response;
  try { response = await fetcher(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ query, variables }) }); }
  catch { throw new BufferError('NETWORK', 'Could not reach Buffer.'); }
  if (!response.ok) throw new BufferError(response.status === 401 || response.status === 403 ? 'AUTH' : 'UPSTREAM', 'Buffer rejected the connection.');
  const body = await response.json();
  if (body.errors?.length) throw new BufferError(body.errors[0]?.extensions?.code === 'UNAUTHORIZED' ? 'AUTH' : 'GRAPHQL', 'Buffer could not retrieve connected channels.');
  return body.data;
}
export async function getBufferOrganizations({ apiKey, fetcher } = {}) {
  if (!apiKey) throw new BufferError('NOT_CONFIGURED', 'Buffer is not configured on this server.');
  return (await request(apiKey, ORGANIZATIONS, undefined, fetcher)).account?.organizations || [];
}
export async function getBufferChannels({ apiKey, fetcher } = {}) {
  if (!apiKey) throw new BufferError('NOT_CONFIGURED', 'Buffer is not configured on this server.');
  const organizations = (await request(apiKey, ORGANIZATIONS, undefined, fetcher)).account?.organizations || [];
  const channels = [];
  for (const organization of organizations) channels.push(...((await request(apiKey, CHANNELS, { organizationId: organization.id }, fetcher)).channels || []));
  return channels.map(channel => ({ id: channel.id, service: channel.service, name: channel.displayName || channel.name || channel.service }));
}