import {it,expect} from 'vitest';
import {preparePlatformLeadDeployment} from '../platformLeadSource';
const source={id:'lead',updatedAt:new Date('2026-11-12T00:00:00Z'),aiPackage:{companyName:'Example',tagline:'Example services',aboutText:'About',services:['First service'],contactEmail:'example@example.test'}};
const selection={leadId:'lead',projectName:'reviewed-project',environment:'preview',expiresAt:'2026-11-13T00:00:00Z'},now=Date.parse('2026-11-12T00:00:01Z');
it('derives exact deployment files and source revision from an existing server record',()=>{
 const prepared=preparePlatformLeadDeployment(source,selection,'team_fixture',now);expect(prepared.plan.effects[0]).toMatchObject({kind:'deployment.vercel',target:{projectName:'reviewed-project',teamId:'team_fixture',environment:'preview',leadId:'lead',leadRevision:source.updatedAt.toISOString(),projectCreation:'may_create_named_project'}});expect(prepared.files.map(f=>f.path)).toContain('index.html');expect(prepared.files[0].content).toContain('Example services');
 const changed=preparePlatformLeadDeployment({...source,aiPackage:{...source.aiPackage,tagline:'Changed'}},selection,'team_fixture',now);expect(changed.plan.digest).not.toBe(prepared.plan.digest);
 expect(preparePlatformLeadDeployment({...source,updatedAt:new Date(source.updatedAt.getTime()+1)},selection,'team_fixture',now).plan.sourceDigest).not.toBe(prepared.plan.sourceDigest);
});
it('refuses a substituted source, invalid package, missing team, client hashes or expired selection',()=>{
 for(const [record,input,team] of [[{...source,id:'other'},selection,'team_fixture'],[{...source,aiPackage:{}},selection,'team_fixture'],[source,selection,''],[source,{...selection,filesDigest:'a'.repeat(64)},'team_fixture'],[source,{...selection,expiresAt:'2020-01-01T00:00:00Z'},'team_fixture']] as const)expect(()=>preparePlatformLeadDeployment(record,input,team,now)).toThrow();
});
it('source metadata cannot overwrite the reviewed team, files or configuration',async()=>{
 const {preparePlatformVercelDeployment}=await import('../platformDeployment');
 const source={leadId:'lead',leadRevision:'2026-11-12T00:00:00.000Z',teamId:'team_other',filesDigest:'b'.repeat(64)},files=[{path:'index.html',content:'exact'}];
 const value=preparePlatformVercelDeployment(files,{projectName:'reviewed-project',teamId:'team_fixture',source});expect(value.effect.target.teamId).toBe('team_fixture');expect(value.effect.target.filesDigest).toBe(preparePlatformVercelDeployment(files,{projectName:'reviewed-project',teamId:'team_fixture'}).effect.target.filesDigest);
});
it('refuses an incomplete source reference instead of dropping its lineage',async()=>{
 const {platformEffectSchema}=await import('@/lib/governance/platform/contracts'),effect=preparePlatformLeadDeployment(source,selection,'team_fixture',now).plan.effects[0];
 if(effect.kind!=='deployment.vercel')throw Error('wrong profile');
 const {leadRevision:_,...target}=effect.target;expect(platformEffectSchema.safeParse({...effect,target}).success).toBe(false);
});
