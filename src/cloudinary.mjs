import { v2 as cloudinary } from 'cloudinary';
export const isCloudinaryConfigured = env => Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
export function uploadMedia(filePath, mimeType, env = process.env) { if (!isCloudinaryConfigured(env)) return Promise.reject(Object.assign(new Error('Cloudinary is not configured.'),{code:'NOT_CONFIGURED'})); cloudinary.config({cloud_name:env.CLOUDINARY_CLOUD_NAME,api_key:env.CLOUDINARY_API_KEY,api_secret:env.CLOUDINARY_API_SECRET,secure:true}); const video = mimeType.startsWith('video/'); const document = mimeType === 'application/pdf'; return new Promise((resolve,reject)=>{ const done=(error,result)=>error?reject(error):resolve({url:result.secure_url,publicId:result.public_id,resourceType:result.resource_type,format:result.format,mimeType:mimeType,bytes:result.bytes,duration:result.duration||null,width:result.width||null,height:result.height||null}); if(video) cloudinary.uploader.upload_large(filePath,{folder:'upplai-design-studio/publishing',resource_type:'video',chunk_size:20_000_000},done); else cloudinary.uploader.upload(filePath,{folder:'upplai-design-studio/publishing',resource_type:document ? 'raw' : 'image'},done); }); }
const publicHttps = value => typeof value === 'string' && /^https:\/\//i.test(value) && !/^https:\/\/(?:localhost|127\.0\.0\.1)/i.test(value);
export async function verifyHostedMedia(media, fetcher = fetch) {
  if (!publicHttps(media?.url)) return { ready: false };
  try {
    const response = await fetcher(media.url, { method: 'HEAD', redirect: 'follow' });
    const contentType = String(response.headers?.get?.('content-type') || '').split(';')[0].toLowerCase();
    const contentLength = Number(response.headers?.get?.('content-length') || 0);
    const expectedPrefix = media.resourceType === 'video' ? 'video/' : 'image/';
    if (!response.ok || !contentType.startsWith(expectedPrefix) || (contentLength && contentLength <= 0)) return { ready: false };
    return { ready: true, media: { ...media, mimeType: contentType, ...(contentLength ? { bytes: contentLength } : {}) } };
  } catch { return { ready: false }; }
}
