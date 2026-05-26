/**
 * LinkedIn image upload — 3-step flow per the Posts API spec.
 *
 *   1. POST /rest/images?action=initializeUpload  → uploadUrl + image URN
 *   2. PUT <uploadUrl> with image bytes           → binary
 *   3. Image URN referenced in the next /rest/posts call's content.media.id
 *
 * The image URN is the value we want — once we have it, the post payload
 * just references it. We don't store the binary anywhere — once uploaded,
 * LinkedIn hosts it.
 */

import "server-only";

const INIT_UPLOAD_URL = "https://api.linkedin.com/rest/images?action=initializeUpload";
const LINKEDIN_REST_VERSION = "202405";

export type ImageUploadResult =
  | { kind: "ok"; urn: string }
  | { kind: "init_failed"; status: number; body: string }
  | { kind: "put_failed"; status: number; body: string }
  | { kind: "network_error"; message: string };

interface UploadInput {
  /** Bearer access token from LinkedInAccountConnection.accessToken. */
  accessToken: string;
  /** Owner URN — either personal (urn:li:person:..) or org (urn:li:organization:..). */
  owner: string;
  /** Image bytes. */
  bytes: Buffer;
}

interface InitUploadResponse {
  value: {
    uploadUrlExpiresAt: number;
    uploadUrl: string;
    image: string;
  };
}

export async function uploadImageToLinkedIn(input: UploadInput): Promise<ImageUploadResult> {
  // ---- Step 1: initialize upload, get the upload URL + image URN.
  let init: InitUploadResponse;
  try {
    const res = await fetch(INIT_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization:            `Bearer ${input.accessToken}`,
        "Content-Type":           "application/json",
        "LinkedIn-Version":       LINKEDIN_REST_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        initializeUploadRequest: { owner: input.owner },
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { kind: "init_failed", status: res.status, body: text.slice(0, 500) };
    }
    init = (await res.json()) as InitUploadResponse;
  } catch (err) {
    return { kind: "network_error", message: err instanceof Error ? err.message : String(err) };
  }

  // ---- Step 2: PUT the binary to the upload URL.
  try {
    const putRes = await fetch(init.value.uploadUrl, {
      method:  "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body:    new Uint8Array(input.bytes),
      cache:   "no-store",
    });
    if (!putRes.ok) {
      const text = await putRes.text().catch(() => "");
      return { kind: "put_failed", status: putRes.status, body: text.slice(0, 500) };
    }
  } catch (err) {
    return { kind: "network_error", message: err instanceof Error ? err.message : String(err) };
  }

  // ---- Step 3: caller references init.value.image (the URN) on the next /rest/posts call.
  return { kind: "ok", urn: init.value.image };
}
