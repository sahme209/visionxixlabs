/** Legacy raw-token upload is unavailable. A token plus caller-selected owner
 * is not a reviewed action or a qualified provider upload destination. Managed
 * initialization/PUT grant custody and protocol qualification remain required;
 * this refusal is not complete image-upload coverage or scope removal. */
import "server-only";
export type ImageUploadResult =
  | { kind: "governance_required" }
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

export async function uploadImageToLinkedIn(_input: UploadInput): Promise<ImageUploadResult> {
  return { kind: "governance_required" };
}
