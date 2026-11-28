import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SignedXml } from "xml-crypto";
import { spEndpoints } from "../tenantSaml";

/** Test-only IdP: throwaway keys, metadata and signed responses. */
const dir = mkdtempSync(join(tmpdir(), "v19-saml-"));
export const cleanup = () => rmSync(dir, { recursive: true, force: true });
function keypair(name: string) {
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-subj", `/CN=${name}`, "-days", "2", "-keyout", join(dir, `${name}.key`), "-out", join(dir, `${name}.crt`)], { stdio: "ignore" });
  const cert = readFileSync(join(dir, `${name}.crt`), "utf8");
  return { key: readFileSync(join(dir, `${name}.key`), "utf8"), certBody: cert.replace(/-----[^-]+-----|\s+/g, "") };
}
export const idp = keypair("idp"), rogue = keypair("rogue");
export const IDP = "https://sts.example-idp.com/tenant-1/";
export const sp = spEndpoints("https://visionxixlabs.com", "idp_1");
export const metadataXml = (cert: string, binding = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect") => `<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" entityID="${IDP}">
  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing"><ds:KeyInfo><ds:X509Data><ds:X509Certificate>${cert}</ds:X509Certificate></ds:X509Data></ds:KeyInfo></md:KeyDescriptor>
    <md:SingleSignOnService Binding="${binding}" Location="https://sts.example-idp.com/saml2"/>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`;

export function response(o: { requestId: string; email?: string; audience?: string; issuer?: string; signer?: { key: string; certBody: string }; notOnOrAfter?: Date; groups?: string[] }) {
  const now = new Date(), later = o.notOnOrAfter ?? new Date(now.getTime() + 5 * 60_000);
  const assertion = `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_a${Date.now()}" Version="2.0" IssueInstant="${now.toISOString()}"><saml:Issuer>${o.issuer ?? IDP}</saml:Issuer><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${o.email ?? "alex@example.com"}</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData InResponseTo="${o.requestId}" NotOnOrAfter="${later.toISOString()}" Recipient="${sp.acsUrl}"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="${new Date(now.getTime() - 60_000).toISOString()}" NotOnOrAfter="${later.toISOString()}"><saml:AudienceRestriction><saml:Audience>${o.audience ?? sp.entityId}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="${now.toISOString()}"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement><saml:AttributeStatement><saml:Attribute Name="groups">${(o.groups ?? ["engineering"]).map((g) => `<saml:AttributeValue>${g}</saml:AttributeValue>`).join("")}</saml:Attribute></saml:AttributeStatement></saml:Assertion>`;
  const signer = o.signer ?? idp;
  const sig = new SignedXml({ privateKey: signer.key, publicCert: signer.certBody, signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256", canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#" });
  sig.addReference({ xpath: "//*[local-name(.)='Assertion']", transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", "http://www.w3.org/2001/10/xml-exc-c14n#"], digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256" });
  sig.computeSignature(assertion, { location: { reference: "//*[local-name(.)='Issuer']", action: "after" } });
  const xml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_r${Date.now()}" Version="2.0" IssueInstant="${now.toISOString()}" Destination="${sp.acsUrl}" InResponseTo="${o.requestId}"><saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${o.issuer ?? IDP}</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>${sig.getSignedXml()}</samlp:Response>`;
  return Buffer.from(xml).toString("base64");
}

