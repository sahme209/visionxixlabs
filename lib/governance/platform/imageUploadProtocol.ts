import {z} from 'zod';

/** Source: IMAGE-UPLOAD-PROTOCOL-SOURCE-REVIEW.md. Pure request/response
 * candidate only: these functions do not issue private observations, qualify
 * a provider, select a version, obtain credentials or authorize a send. */
const unavailable = (): never => {throw Error('platform_image_protocol_unavailable');};
const ownerSchema = z.string().max(512).regex(/^urn:li:(?:person|organization):[A-Za-z0-9_-]+$/);
const imageSchema = z.string().max(512).regex(/^urn:li:image:[A-Za-z0-9_-]+$/);
const stamp = z.number().int().nonnegative().safe();
const versionSchema = z.string().regex(/^20[0-9]{2}(?:0[1-9]|1[0-2])$/);

export function imageInitializationRequest(owner: unknown, version: unknown) {
  try {
    const author = ownerSchema.parse(owner), restVersion = versionSchema.parse(version);
    return Object.freeze({
      url: 'https://api.linkedin.com/rest/images?action=initializeUpload',
      method: 'POST' as const,
      headers: Object.freeze({'Content-Type': 'application/json', 'Linkedin-Version': restVersion, 'X-Restli-Protocol-Version': '2.0.0'}),
      body: JSON.stringify({initializeUploadRequest: {owner: author}}),
    });
  } catch {return unavailable();}
}

/** Application subset of the official example, NOT a vendor guarantee that
 * every returned URL has this shape. All other shapes refuse. Never broaden
 * this profile dynamically from a response. The complete address is private. */
export function readImageUploadAddress(raw: unknown, rawImage: unknown): string {
  try {
    const image = imageSchema.parse(rawImage);
    if (typeof raw !== 'string' || raw.length > 8192 || /[^\x21-\x7e]|\\/.test(raw)) return unavailable();
    const prefix = 'https://www.linkedin.com';
    if (!raw.startsWith(prefix + '/')) return unavailable();
    const url = new URL(raw);
    const imageId = image.slice('urn:li:image:'.length);
    if (url.origin !== prefix || url.username || url.password || url.port || url.hash ||
      url.pathname !== `/dms-uploads/${imageId}/uploaded-image/0` ||
      raw.slice(prefix.length).split('?')[0] !== url.pathname) return unavailable();
    const expected = {ca: 'vector_ads', cn: 'uploads', sync: '0', v: 'beta'};
    const entries = Array.from(url.searchParams.entries());
    if (entries.length !== 5 || new Set(entries.map(([key]) => key)).size !== 5 ||
      Object.entries(expected).some(([key, value]) => url.searchParams.get(key) !== value) ||
      !/^[A-Za-z0-9_-]{1,2048}$/.test(url.searchParams.get('ut') ?? '')) return unavailable();
    return raw;
  } catch {return unavailable();}
}

export function readImageInitialization(status: number, raw: unknown, now: number, actionExpiresAt: number) {
  try {
    stamp.parse(now); stamp.parse(actionExpiresAt);
    if (status !== 200 || actionExpiresAt <= now) return unavailable();
    const {value} = z.object({value: z.object({image: imageSchema, uploadUrl: z.string().max(8192), uploadUrlExpiresAt: stamp}).strict()}).strict().parse(raw);
    const expiresAt = Math.min(value.uploadUrlExpiresAt, actionExpiresAt);
    if (expiresAt <= now) return unavailable();
    return Object.freeze({image: value.image, address: readImageUploadAddress(value.uploadUrl, value.image), issuedAt: now, expiresAt});
  } catch {return unavailable();}
}

/** A documented empty 201 acknowledges bytes only. Images API is asynchronous;
 * this is never sufficient for confirmed publication lineage by itself. */
export function readImagePutAcceptance(status: number, responseByteCount: number) {
  if (status !== 201 || responseByteCount !== 0) return unavailable();
  return Object.freeze({uploadAccepted: true as const, mediaReady: false as const});
}

/** A separate exact-resource observation must supply this body. This pure
 * parser does not authenticate it and cannot mint execution/lineage proof.
 * Download URLs/expiry and other provider fields are deliberately not returned. */
export function readImageAvailability(raw: unknown, expectedOwner: unknown, expectedImage: unknown) {
  try {
    const owner = ownerSchema.parse(expectedOwner), image = imageSchema.parse(expectedImage);
    const value = z.object({owner: ownerSchema, id: imageSchema, status: z.enum(['AVAILABLE', 'WAITING_UPLOAD', 'PROCESSING', 'PROCESSING_FAILED'])}).parse(raw);
    if (value.owner !== owner || value.id !== image) return unavailable();
    return Object.freeze({image, owner, mediaReady: value.status === 'AVAILABLE'});
  } catch {return unavailable();}
}
