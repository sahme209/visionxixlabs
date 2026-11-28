/** GET /api/sso/saml/[providerId]/metadata — V19's service provider metadata for one company connection (public, no secrets). */
import { spEndpoints } from "@/lib/identity/saml/tenantSaml";
import { ssoOrigin } from "@/lib/identity/oidc/tenantSsoDeps";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export async function GET(_request: Request, { params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  const origin = ssoOrigin();
  if (!origin || !/^[A-Za-z0-9_-]{1,64}$/.test(providerId)) return new Response("Not found", { status: 404 });
  const sp = spEndpoints(origin, providerId);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${esc(sp.entityId)}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${esc(sp.acsUrl)}" index="1" isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>
`;
  return new Response(xml, { headers: { "Content-Type": "application/samlmetadata+xml", "Cache-Control": "public, max-age=300" } });
}
