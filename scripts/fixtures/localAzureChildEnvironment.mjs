import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
export function localAzureChildEnvironment(base,{appOrigin,mailOrigin,fixture}) {
 assert.ok(!Object.keys(base).some(key=>key==="NODE_OPTIONS"||key==="CREDENTIAL_ENCRYPTION_KEY"||key.startsWith("AZURE_")||key.startsWith("ARM_")||key.startsWith("AXIOM_OWNED_AZURE_")),"inherited_azure_fixture_configuration_forbidden");
 const origins=[appOrigin,mailOrigin,fixture.origin];for(const value of origins){const url=new URL(value);assert.ok(url.protocol==="http:"&&url.hostname==="127.0.0.1"&&url.port&&url.pathname==="/"&&!url.username&&!url.password&&!url.search&&!url.hash,"owned_azure_child_origins_required");}
 const preload=fileURLToPath(new URL("./ownedAzureHttpPreload.cjs",import.meta.url));assert.ok(!/\s/.test(preload));
 const next={...base};delete next.HOME;
 return {...next,NODE_OPTIONS:`--require=${preload}`,CREDENTIAL_ENCRYPTION_KEY:fixture.encryptionSecret,AXIOM_OWNED_AZURE_WIRE:"1",AXIOM_OWNED_AZURE_HTTP_ORIGINS:JSON.stringify(origins),AXIOM_OWNED_AZURE_ORIGIN:fixture.origin,AXIOM_OWNED_AZURE_PROOF:fixture.proof};
}
