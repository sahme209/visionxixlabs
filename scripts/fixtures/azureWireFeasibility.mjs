import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startOwnedAzureWireFixture } from "./ownedAzureWireFixture.mjs";
import { localAzureChildEnvironment } from "./localAzureChildEnvironment.mjs";
/** Small permanent actual-source SDK probe; no Next/database server and no real provider. */
const fixture = await startOwnedAzureWireFixture();
try {
 const base = Object.fromEntries(["PATH", "LANG", "TMPDIR"].filter(key => typeof process.env[key] === "string").map(key => [key, process.env[key]]));
 base.DATABASE_URL="postgresql://fixture:fixture@127.0.0.1:12345/axiom_auth_http_123456789abc"; // guard selector only; never connected.
 const env=localAzureChildEnvironment(base,{appOrigin:"http://127.0.0.1:12346",mailOrigin:"http://127.0.0.1:12347",fixture});
 const probe=fileURLToPath(new URL("./azureProviderWireProbe.cjs",import.meta.url));
 const child=spawn(process.execPath,["--conditions=react-server",probe],{env,stdio:["ignore","pipe","pipe"]});
 let output="",error="";child.stdout.on("data",chunk=>{output+=chunk;assert.ok(output.length<=16384);});child.stderr.on("data",chunk=>{error+=chunk;assert.ok(error.length<=16384);});
 const timer=setTimeout(()=>child.kill("SIGKILL"),30000);
 const code=await new Promise((resolve,reject)=>{child.once("error",reject);child.once("exit",resolve);});clearTimeout(timer);
 if(code!==0) console.error(JSON.stringify({wire:fixture.report(),guardReady:"private_probe_failure"}));
 assert.equal(code,0,error.includes("owned_azure_source_probe_failed")?"owned_azure_source_probe_failed":"owned_azure_child_failed");
 fixture.assertReady();const result=JSON.parse(output.trim());
 assert.deepEqual(fixture.report().requests,["Token","Subscription","Token","ResourceGroupsFirstPage"]);
 console.log(JSON.stringify({...result,wire:fixture.report()},null,2));
} finally {await fixture.close();}
