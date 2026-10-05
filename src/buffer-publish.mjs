import { getBufferChannels } from './buffer.mjs';
import { verifyHostedMedia } from './cloudinary.mjs';

const safeMessage = value => String(value || '').replace(/[\r\n]+/g, ' ').slice(0, 180);
const publicUrl = value => typeof value === 'string' && /^https:\/\//i.test(value) && !/^(?:https:\/\/)?(?:localhost|127\.0\.0\.1)/i.test(value);
const imageMimes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const videoMimes = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

export function validateTikTokMedia(media) {
  if (!media || media.type === 'carousel') return { ok: false, message: media?.type === 'carousel' ? 'TikTok multi-image publishing is not available yet. Publish one image or video.' : 'TikTok requires a prepared image or video.' };
  const image = media.resourceType === 'image';
  const video = media.resourceType === 'video';
  if (!publicUrl(media.url) || (!image && !video)) return { ok: false, message: 'TikTok media could not be prepared correctly. Please retry.' };
  if ((image && media.mimeType && !imageMimes.has(media.mimeType)) || (video && media.mimeType && !videoMimes.has(media.mimeType))) return { ok: false, message: 'TikTok media could not be prepared correctly. Please retry.' };
  if ((media.bytes !== undefined && Number(media.bytes) <= 0) || (media.width !== undefined && Number(media.width) <= 0) || (media.height !== undefined && Number(media.height) <= 0)) return { ok: false, message: 'TikTok media could not be prepared correctly. Please retry.' };
  return { ok: true };
}

export function buildInstagramPostInput(media) {
  if (!media) return undefined;
  // Buffer requires this metadata for every Instagram post. This product's
  // static-image flow is a normal feed post, not a Story or Reel.
  return { instagram: { type: 'post', shouldShareToFeed: true } };
}

export function normalizeTikTokTitle(value, fallback = '') {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  const candidate = normalized || String(fallback || '').replace(/\s+/g, ' ').trim() || 'Upplai post';
  if (candidate.length <= 90) return candidate;
  const boundary = candidate.lastIndexOf(' ', 90);
  return (boundary >= 24 ? candidate.slice(0, boundary) : candidate.slice(0, 90)).trim();
}

export function buildTikTokPostInput(media, title, caption = '') {
  if (!media) return undefined;
  // TikTokPostMetadataInput accepts `title` for photo posts. It does not
  // accept a `type` field; Buffer infers the format from the image/video asset.
  return media.resourceType === 'image'
    ? { tiktok: { title: normalizeTikTokTitle(title, caption) } }
    : { tiktok: {} };
}

export function buildPlatformMetadata(channel, media, caption, tiktokTitle = '') {
  if (channel?.service === 'facebook') return { facebook: { type: 'post' } };
  if (channel?.service === 'instagram') return buildInstagramPostInput(media);
  if (channel?.service === 'tiktok') return buildTikTokPostInput(media, tiktokTitle, caption);
  return undefined;
}
const altTextServices = new Set(['x', 'twitter', 'mastodon', 'threads', 'linkedin', 'pinterest', 'facebook', 'instagram', 'bluesky']);
const cleanAltText = value => typeof value === 'string' ? value.trim().slice(0, 2000) : '';

function assetsFor(media, altText = '', slideAltText = []) {
  if (!media) return undefined;
  if (media.resourceType === 'document') {
    const title = String(media.title || '').trim().slice(0, 120);
    if (!publicUrl(media.url) || !title || !publicUrl(media.thumbnailUrl)) throw new Error('LinkedIn document preparation is incomplete. A PDF, title, and first-slide thumbnail are required.');
    return [{ document: { url: media.url, title, thumbnailUrl: media.thumbnailUrl } }];
  }
  if (media.type === 'carousel') return media.items.map((item, index) => ({ image: { url: item.url, ...(cleanAltText(slideAltText[index] || altText) ? { metadata: { altText: cleanAltText(slideAltText[index] || altText) } } : {}) } }));
  return media.resourceType === 'video' ? [{ video: { url: media.url } }] : [{ image: { url: media.url, ...(cleanAltText(altText) ? { metadata: { altText: cleanAltText(altText) } } : {}) } }];
}

export async function publishPosts({ apiKey, text, channelTexts = {}, tiktokTitle = '', accessibility = {}, channelIds, mode, dueAt, media, mediaByChannel = {}, fetcher = fetch, mediaVerifier = verifyHostedMedia }) {
  const channels = await getBufferChannels({ apiKey, fetcher });
  const channelById = new Map(channels.map(channel => [channel.id, channel]));
  const results = [];

  for (const channelId of channelIds) {
    const channel = channelById.get(channelId);
    if (!channel) { results.push({ channelId, success: false, error: 'Selected channel is unavailable.' }); continue; }
    const channelText = typeof channelTexts[channelId] === 'string' && channelTexts[channelId].trim() ? channelTexts[channelId].trim() : text;
    let preparedMedia = mediaByChannel[channelId] || media;

    if (channel.service === 'tiktok') {
      const validity = validateTikTokMedia(media);
      if (!validity.ok) { results.push({ channelId, success: false, error: validity.message }); continue; }
      const readiness = await mediaVerifier(media);
      if (!readiness?.ready) { results.push({ channelId, success: false, error: 'TikTok media could not be prepared correctly. Please retry.' }); continue; }
      preparedMedia = readiness.media || media;
      console.info('[TikTok Publish Preparation]', {
        mediaType: preparedMedia.resourceType,
        mimeType: preparedMedia.mimeType || null,
        dimensions: `${preparedMedia.width || '?'}x${preparedMedia.height || '?'}`,
        bytes: preparedMedia.bytes || 0,
        cloudinaryResourceType: preparedMedia.resourceType,
        hostedAssetReady: true,
        bufferMediaCount: 1,
        bufferPostType: 'post'
      });
    }

    const metadata = buildPlatformMetadata(channel, preparedMedia, channelText, tiktokTitle);
    if (channel.service === 'tiktok' && metadata?.tiktok?.title) console.info('[TikTok Title]', { source: String(tiktokTitle || '').trim() ? 'headline' : 'caption-fallback', rawLength: String(tiktokTitle || channelText || '').length, finalLength: metadata.tiktok.title.length });

    const requestedAlt = accessibility.altTextMode === 'platform' ? accessibility.platformAltText?.[channelId] : accessibility.genericAltText;
    const altText = altTextServices.has(channel.service) ? cleanAltText(requestedAlt) : '';
    const slideAltText = altTextServices.has(channel.service) ? accessibility.carouselSlideAltText : [];
    const assets = assetsFor(preparedMedia, altText, slideAltText);
    const query = `mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { post { id status dueAt } } ... on MutationError { message } } }`;
    const input = { text: channelText, channelId, schedulingType: 'automatic', mode, ...(dueAt ? { dueAt } : {}), ...(assets ? { assets } : {}), ...(metadata ? { metadata } : {}) };

    try {
      const response = await fetcher('https://api.buffer.com', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ query, variables: { input } }) });
      const body = await response.json();
      const value = body.data?.createPost;
      const graphqlErrors = (body.errors || []).map(error => safeMessage(error.message)).filter(Boolean);
      const mutationError = safeMessage(value?.message);
      if (!response.ok || graphqlErrors.length || !value?.post) {
        const message = graphqlErrors[0] || mutationError || 'Buffer could not create this post.';
        console.error('[Buffer Publish Error]', { status: response.status, channelId, mode, hasDueAt: Boolean(dueAt), hasMedia: Boolean(media?.url || media?.items?.length), mediaType: media?.type || media?.resourceType || null, graphqlErrors, mutationError: mutationError || null, responseData: value ? { typename: value.__typename || null, hasPost: Boolean(value.post) } : null });
        results.push({ channelId, success: false, error: message });
        continue;
      }
      results.push({ channelId, success: true, postId: value.post.id, status: value.post.status, dueAt: value.post.dueAt || dueAt || null });
    } catch (error) {
      console.error('[Buffer Publish Error]', { status: error?.status || 0, channelId, mode, hasDueAt: Boolean(dueAt), hasMedia: Boolean(media?.url || media?.items?.length), mediaType: media?.type || media?.resourceType || null, graphqlErrors: [], mutationError: safeMessage(error?.message) || null, responseData: null });
      results.push({ channelId, success: false, error: safeMessage(error?.message) || 'Buffer could not create this post.' });
    }
  }
  return results;
}
