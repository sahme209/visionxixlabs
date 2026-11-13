import {describe, expect, it} from 'vitest';
import {
  imageInitializationRequest, readImageInitialization,
  readImageUploadAddress, readImagePutAcceptance, readImageAvailability,
} from '../imageUploadProtocol';

const image = 'urn:li:image:Example_123';
const owner = 'urn:li:organization:123';
const now = 1_800_000_000_000;
const address = 'https://www.linkedin.com/dms-uploads/Example_123/uploaded-image/0?ca=vector_ads&cn=uploads&sync=0&v=beta&ut=synthetic_token';
const response = {value: {image, uploadUrl: address, uploadUrlExpiresAt: now + 60_000}};

describe('fixed LinkedIn image protocol candidate (not qualification)', () => {
  it('constructs only the documented initializer, without recipes or caller transport fields', () => {
    expect(imageInitializationRequest(owner, '202607')).toEqual({
      url: 'https://api.linkedin.com/rest/images?action=initializeUpload',
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Linkedin-Version': '202607', 'X-Restli-Protocol-Version': '2.0.0'},
      body: JSON.stringify({initializeUploadRequest: {owner}}),
    });
    expect(() => imageInitializationRequest('urn:li:sponsoredAccount:123', '202607')).toThrow('platform_image_protocol_unavailable');
    expect(() => imageInitializationRequest(owner, '202613')).toThrow('platform_image_protocol_unavailable');
  });
  it('retains the private exact address but narrows its lifetime to the original action', () => {
    expect(readImageInitialization(200, response, now, now + 30_000)).toEqual({
      image, address, issuedAt: now, expiresAt: now + 30_000,
    });
    for (const status of [201, 202, 301, 403]) expect(() => readImageInitialization(status, response, now, now + 30_000)).toThrow('platform_image_protocol_unavailable');
    for (const expiry of [now, now - 1, Number.MAX_SAFE_INTEGER + 1]) expect(() => readImageInitialization(200, {value: {...response.value, uploadUrlExpiresAt: expiry}}, now, now + 30_000)).toThrow('platform_image_protocol_unavailable');
  });
  it('rejects destinations outside the narrow documented-example subset, without leaking them', () => {
    expect(readImageUploadAddress(address, image)).toBe(address);
    for (const changed of [
      address.replace('www.linkedin.com', 'www.linkedin.com.evil.example'),
      address.replace('https:', 'http:'), address.replace('https://', 'https://user@'),
      address.replace('.com/', '.com:443/'), address + '#fragment',
      address.replace('/Example_123/', '/Other/'), address.replace('/uploaded-image/', '/feedshare-uploadedImage/'),
      address.replace('/uploaded-image/', '/%75ploaded-image/'), address + '&ut=duplicate',
      address + '&redirect=https://evil.example', address.replace('sync=0', 'sync=1'),
      address.replace('https://www', 'https:\\www'), address + '\n',
    ]) {
      try { readImageUploadAddress(changed, image); throw new Error('accepted_bad_address'); }
      catch (error) { expect((error as Error).message).toBe('platform_image_protocol_unavailable'); }
    }
  });
  it('does not mistake byte-upload acceptance for processed or publishable media', () => {
    expect(readImagePutAcceptance(201, 0)).toEqual({uploadAccepted: true, mediaReady: false});
    for (const [status, size] of [[200, 0], [204, 0], [201, 1], [302, 0]]) expect(() => readImagePutAcceptance(status, size)).toThrow('platform_image_protocol_unavailable');
  });
  it('requires the exact owner and image plus AVAILABLE to establish processing readiness', () => {
    expect(readImageAvailability({owner, id: image, status: 'AVAILABLE', downloadUrl: 'https://irrelevant.example/private'}, owner, image)).toEqual({image, owner, mediaReady: true});
    for (const status of ['WAITING_UPLOAD', 'PROCESSING', 'PROCESSING_FAILED']) expect(readImageAvailability({owner, id: image, status}, owner, image)).toEqual({image, owner, mediaReady: false});
    for (const body of [{owner: 'urn:li:organization:456', id: image, status: 'AVAILABLE'}, {owner, id: 'urn:li:image:Other', status: 'AVAILABLE'}, {owner, id: image, status: 'UNKNOWN'}]) expect(() => readImageAvailability(body, owner, image)).toThrow('platform_image_protocol_unavailable');
  });
});
