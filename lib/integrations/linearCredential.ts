import {validateActionConsentScopes} from './connectedActionScopes';
export interface StoredLinearCredential {
  purpose?:'connected_app_actions_v1';
  actionScopes?:string[];
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

export function parseStoredLinearCredential(value: string): StoredLinearCredential | null {
  try {
    const parsed = JSON.parse(value) as { accessToken?: unknown; refreshToken?: unknown; expiresAt?: unknown;purpose?:unknown;actionScopes?:unknown };
    if (typeof parsed.accessToken !== "string" || !parsed.accessToken) return null;
    const action=parsed.purpose==='connected_app_actions_v1'?{purpose:'connected_app_actions_v1' as const,actionScopes:validateActionConsentScopes('linear',parsed.actionScopes)}:{};
    return {
      ...action,
      accessToken: parsed.accessToken,
      refreshToken: typeof parsed.refreshToken === "string" && parsed.refreshToken ? parsed.refreshToken : null,
      expiresAt: typeof parsed.expiresAt === "number" && Number.isFinite(parsed.expiresAt) ? parsed.expiresAt : null,
    };
  } catch {
    return null;
  }
}

export function linearCredentialRefreshDue(credential: StoredLinearCredential, now = Date.now(), refreshBufferMs = 60_000): boolean {
  return Boolean(credential.refreshToken) && credential.expiresAt !== null && credential.expiresAt - now <= refreshBufferMs;
}
