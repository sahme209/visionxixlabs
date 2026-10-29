import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { AirflowClient, validateAirflowBaseUrl } from '../airflowClient';
const enabled=process.env.AXIOM_HOSTED_AIRFLOW_ACCEPTANCE==='1';
describe.skipIf(!enabled)('actual isolated hosted Airflow trial',()=>{
 it('validates the public deployment and reads owned DAG metadata',async()=>{
  const dir=process.env.AXIOM_AIRFLOW_TRIAL_PRIVATE_DIR!;
  const config=JSON.parse(readFileSync(`${dir}/deployment-config.json`,'utf8'));
  const api=config.deployment.metadata.airflow_api_url as string;
  const base=await validateAirflowBaseUrl(`https://${api.replace(/\/api\/v2$/,'')}`);
  const client=new AirflowClient(base,{authMode:'token',token:readFileSync(`${dir}/deployment-token`,'utf8').trim()});
  expect(await client.validate()).toMatchObject({version:expect.stringMatching(/^3\.3\.2(?:\+.*)?$/)});
  const dags=await client.listDags();
  expect(dags.find(d=>d.dagId==='axiom_hosted_acceptance_20261028')?.tags).toContain('axiom-owned-acceptance');
 },60000);
});

describe.skipIf(!enabled || process.env.AXIOM_HOSTED_AIRFLOW_NOOP_ONCE!=='1')('explicit single hosted no-op engine test',()=>{
 it('submits once or observes the existing attempt, never automatically resends',async()=>{
  const dir=process.env.AXIOM_AIRFLOW_TRIAL_PRIVATE_DIR!;
  const config=JSON.parse(readFileSync(`${dir}/deployment-config.json`,'utf8'));
  const base=await validateAirflowBaseUrl(`https://${config.deployment.metadata.airflow_api_url.replace(/\/api\/v2$/,'')}`);
  const client=new AirflowClient(base,{authMode:'token',token:readFileSync(`${dir}/deployment-token`,'utf8').trim()});
  const dagId='axiom_hosted_acceptance_20261028',runId='axiom_hosted_acceptance__20261028_once';
  const claim=`${dir}/noop-attempt.json`;
  if(!existsSync(claim)){
   const dag=(await client.listDags()).find(d=>d.dagId===dagId);
   expect(dag?.tags).toContain('axiom-owned-acceptance');
   writeFileSync(claim,JSON.stringify({dagId,runId,state:'dispatching',createdAt:new Date().toISOString()}),{flag:'wx',mode:0o600});
   const run=await client.triggerDag(dagId,{},runId);
   writeFileSync(claim,JSON.stringify({dagId,runId,state:'submitted',run,updatedAt:new Date().toISOString()}),{mode:0o600});
  }
  const run=await client.getDagRun(dagId,runId);
  const page=await client.listTaskInstances(dagId,runId);
  writeFileSync(`${dir}/noop-observation.json`,JSON.stringify({observedAt:new Date().toISOString(),run,page},null,2),{mode:0o600});
  expect(run.dagRunId).toBe(runId);
  expect(['queued','running','success']).toContain(run.state);
  if(process.env.AXIOM_HOSTED_AIRFLOW_REQUIRE_SUCCESS==='1'){
   expect(run.state).toBe('success');
   expect(page.tasks.map(t=>[t.taskId,t.state]).sort()).toEqual([['finish','success'],['start','success']]);
  }
 },60000);
});
