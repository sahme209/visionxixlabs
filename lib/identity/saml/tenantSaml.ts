/**
 * Per-workspace SAML 2.0 sign-in (docs/ENTERPRISE_IDENTITY_DESIGN.md, "Sign-in flow (SAML)").
 *
 * V19 is the service provider. Signature, audience, destination, time conditions and
 * InResponseTo validation are done by @node-saml/node-saml with: signed assertions required, the
 * IdP's entity ID pinned as the issuer, the IdP's signing certificates taken only from the
 * metadata the admin saved, and every response bound to the one AuthnRequest V19 sent for the
 * one sign-in attempt it belongs to (no unsolicited, IdP-initiated responses).
 */
import { DOMParser } from "@xmldom/xmldom";
import * as xpath from "xpath";
import { SAML, ValidateInResponseTo, type CacheProvider, type Profile } from "@node-saml/node-saml";

export interface IdpMetadata { entityId: string; ssoUrl: string; certificates: string[] }
export class SamlError extends Error { constructor(readonly code: "sso.saml_metadata_invalid" | "sso.saml_response_invalid" | "sso.email_missing" | "sso.email_domain_mismatch") { super(code); } }

const select = xpath.useNamespaces({ md: "urn:oasis:names:tc:SAML:2.0:metadata", ds: "http://www.w3.org/2000/09/xmldsig#" });
const REDIRECT = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect";

/** Reads entity ID, HTTP-Redirect SSO URL and signing certificates from IdP metadata. Refuses anything incomplete or non-HTTPS. */
export function parseIdpMetadata(xml: string): IdpMetadata {
  if (typeof xml !== "string" || xml.length > 512 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new SamlError("sso.saml_metadata_invalid");
  let doc: Document;
  try {
    const errors: string[] = [];
    doc = new DOMParser({ errorHandler: (level: string, msg: unknown) => { if (level !== "warning") errors.push(String(msg)); } }).parseFromString(xml, "text/xml") as unknown as Document;
    if (errors.length) throw new Error("parse");
  } catch {
    throw new SamlError("sso.saml_metadata_invalid");
  }
  const entity = select("//md:EntityDescriptor[md:IDPSSODescriptor]", doc as unknown as Node) as Element[];
  if (entity.length !== 1) throw new SamlError("sso.saml_metadata_invalid");
  const entityId = entity[0].getAttribute("entityID") ?? "";
  const sso = (select("md:IDPSSODescriptor/md:SingleSignOnService", entity[0]) as Element[]).find((e) => e.getAttribute("Binding") === REDIRECT);
  const ssoUrl = sso?.getAttribute("Location") ?? "";
  const certs = (select("md:IDPSSODescriptor/md:KeyDescriptor[not(@use) or @use='signing']/ds:KeyInfo/ds:X509Data/ds:X509Certificate", entity[0]) as Element[])
    .map((e) => (e.textContent ?? "").replace(/\s+/g, ""))
    .filter((c) => /^[A-Za-z0-9+/=]{100,20000}$/.test(c));
  let https = false;
  try { https = new URL(ssoUrl).protocol === "https:"; } catch { /* invalid URL */ }
  if (!entityId || entityId.length > 1024 || !https || certs.length === 0) throw new SamlError("sso.saml_metadata_invalid");
  return { entityId, ssoUrl, certificates: [...new Set(certs)] };
}

/** The SP entity ID and ACS URL V19 presents for one provider row. */
export function spEndpoints(origin: string, providerId: string) {
  return { entityId: `${origin}/api/sso/saml/${providerId}/metadata`, acsUrl: `${origin}/api/sso/saml/acs` };
}

function client(meta: IdpMetadata, sp: { entityId: string; acsUrl: string }, cacheProvider: CacheProvider) {
  return new SAML({
    entryPoint: meta.ssoUrl,
    issuer: sp.entityId,
    callbackUrl: sp.acsUrl,
    audience: sp.entityId,
    idpIssuer: meta.entityId,
    idpCert: meta.certificates,
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
    validateInResponseTo: ValidateInResponseTo.always,
    requestIdExpirationPeriodMs: 10 * 60_000,
    acceptedClockSkewMs: 60_000,
    maxAssertionAgeMs: 10 * 60_000,
    identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    disableRequestedAuthnContext: true,
    cacheProvider,
  });
}

/** Builds the AuthnRequest redirect. Returns the request ID so the response can be bound to it. */
export async function samlAuthorize(meta: IdpMetadata, sp: { entityId: string; acsUrl: string }, relayState: string): Promise<{ url: string; requestId: string }> {
  let requestId = "";
  const capture: CacheProvider = {
    async saveAsync(key, value) { requestId = key; return { value, createdAt: Date.now() }; },
    async getAsync() { return null; },
    async removeAsync() { return null; },
  };
  const url = await client(meta, sp, capture).getAuthorizeUrlAsync(relayState, undefined, {});
  if (!requestId) throw new SamlError("sso.saml_metadata_invalid");
  return { url, requestId };
}

export interface SamlIdentity { email: string; claims: Record<string, unknown> }

/** Validates a POSTed SAMLResponse that must answer exactly `requestId`. */
export async function samlValidate(meta: IdpMetadata, sp: { entityId: string; acsUrl: string }, input: { samlResponse: string; requestId: string; requestCreatedAt: Date; managedDomains: readonly string[] }): Promise<SamlIdentity> {
  // Only the one request ID this attempt sent is known; the attempt row itself was consumed once already.
  const created = input.requestCreatedAt.toISOString();
  let consumed = false;
  const bound: CacheProvider = {
    async saveAsync() { return null; },
    async getAsync(key) { return key === input.requestId ? created : null; },
    async removeAsync(key) { if (key === input.requestId && !consumed) { consumed = true; return created; } return null; },
    async consumeAsync(key) { if (key === input.requestId && !consumed) { consumed = true; return created; } return null; },
  };
  let profile: Profile | null;
  try {
    ({ profile } = await client(meta, sp, bound).validatePostResponseAsync({ SAMLResponse: input.samlResponse }));
  } catch {
    throw new SamlError("sso.saml_response_invalid");
  }
  if (!profile || profile.issuer !== meta.entityId) throw new SamlError("sso.saml_response_invalid");
  const candidates = [profile.email, profile.mail, profile["urn:oid:0.9.2342.19200300.100.1.3"], profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"], profile.nameID];
  const raw = candidates.find((v): v is string => typeof v === "string" && /^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/.test(v.trim()));
  if (!raw) throw new SamlError("sso.email_missing");
  const email = raw.trim().toLowerCase();
  if (!input.managedDomains.some((d) => d.toLowerCase() === email.split("@")[1])) throw new SamlError("sso.email_domain_mismatch");
  const claims: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(profile)) if (typeof v !== "function") claims[k] = v;
  return { email, claims };
}
