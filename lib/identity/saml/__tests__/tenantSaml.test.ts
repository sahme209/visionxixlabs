import { afterAll, describe, expect, it } from "vitest";
import { parseIdpMetadata, samlAuthorize, samlValidate } from "../tenantSaml";
import { cleanup, IDP, idp, metadataXml, response, rogue, sp } from "./samlFixture";

afterAll(cleanup);

describe("tenant SAML", () => {
  const meta = parseIdpMetadata(metadataXml(idp.certBody));

  it("reads IdP metadata and refuses incomplete or dangerous metadata", () => {
    expect(meta).toEqual({ entityId: IDP, ssoUrl: "https://sts.example-idp.com/saml2", certificates: [idp.certBody] });
    expect(() => parseIdpMetadata(metadataXml(idp.certBody, "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"))).toThrow("sso.saml_metadata_invalid");
    expect(() => parseIdpMetadata(metadataXml(""))).toThrow("sso.saml_metadata_invalid");
    expect(() => parseIdpMetadata(`<!DOCTYPE x [<!ENTITY a "b">]>${metadataXml(idp.certBody)}`)).toThrow("sso.saml_metadata_invalid");
    expect(() => parseIdpMetadata("not xml")).toThrow("sso.saml_metadata_invalid");
  });

  it("sends an AuthnRequest to the IdP and accepts the signed answer to it", async () => {
    const { url, requestId } = await samlAuthorize(meta, sp, "relay-state-1");
    expect(url.startsWith("https://sts.example-idp.com/saml2?SAMLRequest=")).toBe(true);
    expect(new URL(url).searchParams.get("RelayState")).toBe("relay-state-1");
    const id = await samlValidate(meta, sp, { samlResponse: response({ requestId, email: "Alex@Example.com" }), requestId, requestCreatedAt: new Date(), managedDomains: ["example.com"] });
    expect(id.email).toBe("alex@example.com");
    expect(id.claims.groups).toEqual("engineering");
  });

  it("refuses a different signer, a different request, the wrong audience or issuer, expiry, and foreign domains", async () => {
    const { requestId } = await samlAuthorize(meta, sp, "r");
    const v = (samlResponse: string, managedDomains = ["example.com"]) => samlValidate(meta, sp, { samlResponse, requestId, requestCreatedAt: new Date(), managedDomains });
    await expect(v(response({ requestId, signer: rogue }))).rejects.toThrow("sso.saml_response_invalid");
    await expect(v(response({ requestId: "_unsolicited" }))).rejects.toThrow("sso.saml_response_invalid");
    await expect(v(response({ requestId, audience: "https://other-sp.example" }))).rejects.toThrow("sso.saml_response_invalid");
    await expect(v(response({ requestId, issuer: "https://evil.example/" }))).rejects.toThrow("sso.saml_response_invalid");
    await expect(v(response({ requestId, notOnOrAfter: new Date(Date.now() - 10 * 60_000) }))).rejects.toThrow("sso.saml_response_invalid");
    await expect(v(response({ requestId, email: "alex@other.com" }))).rejects.toThrow("sso.email_domain_mismatch");
    const tampered = Buffer.from(Buffer.from(response({ requestId }), "base64").toString().replace("engineering", "admins")).toString("base64");
    await expect(v(tampered)).rejects.toThrow("sso.saml_response_invalid");
  });
});
