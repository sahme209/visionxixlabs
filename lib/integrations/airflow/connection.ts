import "server-only";

import {assertNoGovernanceEnrollmentForMutation} from "@/lib/governance/intelligence/enrollmentMetadata";
import {withGithubAbort} from "@/lib/connectors/github/boundedGithubRead";
import { prisma } from "@/lib/db";
import { decryptScopedCredential } from "@/lib/security/credentialVault";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
import { AirflowClient, validateAirflowBaseUrl, type AirflowCredential,type AirflowMutationAuthority } from "./airflowClient";

/** Reads retain existing access. Mutation callers must supply a server-created
 * current actor/rule callback. Refusal is repeated outside DB locks before
 * credentials/auth and the actual POST; it is not an atomic network/drain or
 * enrollment-coverage protocol for already in-flight provider actions. */
export async function loadAirflowClient(organizationId: string, mutation?:AirflowMutationAuthority): Promise<{ client: AirflowClient; connectionId: string; baseUrl: string; connectionUpdatedAt: Date }> {
  const authority=mutation?Object.freeze({beforeWrite:mutation.beforeWrite,signal:mutation.signal}):undefined;
  const connection = await prisma.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId, provider: "airflow" } } });
  if (!connection || connection.organizationId !== organizationId || connection.provider !== "airflow" || connection.status !== "active" || connection.revokedAt) throw new Error("airflow_not_connected");
  const metadata = connection.scopesJson as { baseUrl?: unknown } | null;
  if (typeof metadata?.baseUrl !== "string") throw new Error("airflow_connection_invalid");
  if(!(connection.updatedAt instanceof Date)||!Number.isFinite(connection.updatedAt.getTime()))throw Error('airflow_connection_invalid');
  const observed = { id: connection.id, updatedAt: connection.updatedAt.getTime(), encryptedCredential: connection.encryptedCredential,baseUrl:metadata.baseUrl };
  const currentConnection=async(signal?:AbortSignal)=>{
    signal?.throwIfAborted();
    const read=prisma.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId,provider:'airflow'}}});
    const current=signal?await withGithubAbort(read,signal):await read;
    const currentMetadata=current?.scopesJson as {baseUrl?:unknown}|null;
    if(!current||current.id!==observed.id||current.organizationId!==organizationId||current.provider!=='airflow'||current.status!=='active'||current.revokedAt||!(current.updatedAt instanceof Date)||current.updatedAt.getTime()!==observed.updatedAt||current.encryptedCredential!==observed.encryptedCredential||currentMetadata?.baseUrl!==observed.baseUrl)throw Error('airflow_connection_changed');
    signal?.throwIfAborted();
  };
  const beforeWrite=async(signal:AbortSignal)=>{
    signal.throwIfAborted();if(typeof authority?.beforeWrite!=='function')throw Error('airflow_mutation_authority_unavailable');
    await withGithubAbort(authority.beforeWrite(signal),signal);await currentConnection(signal);
    await assertNoGovernanceEnrollmentForMutation(prisma,organizationId,signal);signal.throwIfAborted();
    // Metadata can await long enough for an actor or scheduled rule to change.
    const assertFresh=await withGithubAbort(authority.beforeWrite(signal),signal);
    signal.throwIfAborted();if(typeof assertFresh==='function')assertFresh();return assertFresh;
  };
  const mutationSignal=authority?AbortSignal.any([...(authority.signal?[authority.signal]:[]),AbortSignal.timeout(20000)]):undefined;
  if(mutationSignal)await beforeWrite(mutationSignal);
  const baseUrl = mutationSignal?await withGithubAbort(validateAirflowBaseUrl(metadata.baseUrl),mutationSignal):await validateAirflowBaseUrl(metadata.baseUrl);
  // DNS/host validation can await. Never decrypt credentials from a connection
  // disconnected or replaced while that validation was outstanding.
  await currentConnection(mutationSignal);
  if(mutationSignal)await beforeWrite(mutationSignal);
  const raw = decryptScopedCredential(connection.encryptedCredential, connectionCredentialContext({ organizationId, provider: "airflow", connectionId: connection.id }));
  const credential = JSON.parse(raw) as AirflowCredential;
  return { client: new AirflowClient(baseUrl, credential,authority?{beforeWrite,signal:mutationSignal}:undefined), connectionId: connection.id, baseUrl, connectionUpdatedAt: new Date(observed.updatedAt) };
}
