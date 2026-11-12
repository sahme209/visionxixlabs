import {it,expect,vi} from 'vitest';
import {randomBytes} from 'node:crypto';
import {compileOperationalManifest} from '../kernel';
import {createPlatformAction} from '../../kernel';
import {compileOperationalSettingsPlan} from '../settingsArtifact';
import {createSettingsArtifactStore} from '../settingsArtifactStore';
const now=Date.parse('2026-11-12T00:00:00Z'),actor={userId:'creator',sessionId:'session'},id='platform_action_11111111-1111-4111-8111-111111111111';
function fixture(present=false){
 const manifest=compileOperationalManifest({format:1,scope:'platform',kind:'settings.vercel',artifactProfileId:'synthetic-profile',expiresAt:new Date(now+60000).toISOString(),target:{projectId:'project',teamId:'team'},settings:[{name:'SYNTHETIC',environment:'production',type:'encrypted',sensitivity:'secret',artifactId:'platform_artifact_11111111-1111-4111-8111-111111111111',current:present?{kind:'present',id:'existing-setting',updatedAt:now,receiptId:'platform_evidence_11111111-1111-4111-8111-111111111111'}:{kind:'absent',receiptId:'platform_evidence_11111111-1111-4111-8111-111111111111'}}]});
 let parent=createPlatformAction(compileOperationalSettingsPlan(manifest),actor,now),clock=now,revoked=false;const rows=new Map<string,unknown>();
 const unused=async():Promise<never>=>{throw Error('unused fixture port')};
 const tx={readGrowthPostingSource:unused,readSessionPrincipal:unused,readPrincipal:unused,insert:unused,replace:vi.fn(async(_id:string,_version:number,next:typeof parent)=>{parent=next}),event:vi.fn(async()=>{}),readEffect:unused,writeEffect:unused,lock:vi.fn(async()=>{}),read:async()=>parent,now:async()=>clock,reserveSettingsCreation:unused,readSettingsArtifact:vi.fn(async(key:string)=>rows.get(key)??null),insertSettingsArtifact:vi.fn(async(key:string,row:unknown)=>{if(rows.has(key))throw Error('duplicate');rows.set(key,row)})};
 const authority={assertCurrent:vi.fn(async()=>{if(revoked)throw Error('private detail')})},key=randomBytes(32),source={readManifest:vi.fn(async()=>manifest),assertCurrent:vi.fn(async()=>{}),readKey:vi.fn(async()=>key)};
 const repo={transaction:async<T>(fn:(t:typeof tx)=>Promise<T>)=>{const before=new Map(rows);try{return await fn(tx)}catch(e){rows.clear();for(const [k,v]of before)rows.set(k,v);throw e}}};
 return {planDigest:parent.plan.digest,store:createSettingsArtifactStore(repo,authority,source),tx,rows,source,key,setClock:(v:number)=>{clock=v},revoke:()=>{revoked=true},approve:()=>{parent={...parent,status:'approved',version:1}}};
}
it('saves one immutable private envelope and returns metadata only; duplicate never replaces or reads a key',async()=>{
 const f=fixture(),before=Buffer.from(f.key),result=await f.store.save(id,0,actor,'synthetic value');expect(JSON.stringify(result)).not.toContain('synthetic value');expect(f.key).toEqual(before);expect(f.rows.size).toBe(1);expect(JSON.stringify([...f.rows.values()])).not.toContain('synthetic value');f.source.readKey.mockClear();await expect(f.store.save(id,0,actor,'different')).rejects.toThrow('settings_artifact_unavailable');expect(f.source.readKey).not.toHaveBeenCalled();expect(f.tx.insertSettingsArtifact).toHaveBeenCalledTimes(1);
});
it('refuses saving after review and rejects other original identities before custody',async()=>{
 const f=fixture();f.approve();await expect(f.store.save(id,0,actor,'x')).rejects.toThrow('settings_artifact_unavailable');expect(f.source.readKey).not.toHaveBeenCalled();const g=fixture();await expect(g.store.save(id,0,{...actor,sessionId:'other'},'x')).rejects.toThrow();expect(g.source.readKey).not.toHaveBeenCalled();
});
it('rechecks authority, source and database time after awaited custody; failures leave no artifact',async()=>{
 for(const mode of ['revoke','expiry','source']as const){const f=fixture();f.source.readKey.mockImplementation(async()=>{if(mode==='revoke')f.revoke();if(mode==='expiry')f.setClock(now+60000);if(mode==='source')f.source.assertCurrent.mockRejectedValue(Error('private source'));return f.key});await expect(f.store.save(id,0,actor,'x')).rejects.toThrow('settings_artifact_unavailable');expect(f.rows.size).toBe(0)}
});
it('missing custody supplier refuses without fallback or storage',async()=>{
 const f=fixture();f.source.readKey.mockRejectedValue(Error('private custody'));await expect(f.store.save(id,0,actor,'x')).rejects.toThrow('settings_artifact_unavailable');expect(f.rows.size).toBe(0);
});

it('rolls back an inserted envelope if final current-authority confirmation fails',async()=>{
 const f=fixture(),insert=f.tx.insertSettingsArtifact.getMockImplementation()!;f.tx.insertSettingsArtifact.mockImplementation(async(key,row)=>{await insert(key,row);f.revoke()});await expect(f.store.save(id,0,actor,'synthetic')).rejects.toThrow('settings_artifact_unavailable');expect(f.rows.size).toBe(0);
});

it('requires all exact saved artifacts before independent review without decrypting or reading custody',async()=>{
 const f=fixture(),reviewer={userId:'reviewer',sessionId:'reviewer-session'};await expect(f.store.review(id,0,f.planDigest,reviewer)).rejects.toThrow('settings_artifact_unavailable');await f.store.save(id,0,actor,'synthetic');f.source.readKey.mockClear();await expect(f.store.review(id,0,f.planDigest,actor)).rejects.toThrow();const result=await f.store.review(id,0,f.planDigest,reviewer);expect(result).toMatchObject({status:'approved',executionAuthorized:false});expect(f.source.readKey).not.toHaveBeenCalled();expect(f.tx.replace).toHaveBeenCalledTimes(1);expect(f.tx.event).toHaveBeenCalledTimes(1);
});
it('rejects substituted saved bindings at review',async()=>{
 const f=fixture();await f.store.save(id,0,actor,'synthetic');const [key,row]=[...f.rows.entries()][0];const saved=row as {binding:Record<string,unknown>};f.rows.set(key,{...saved,binding:{...saved.binding,profileId:'wrong'}});await expect(f.store.review(id,0,f.planDigest,{userId:'reviewer',sessionId:'reviewer-session'})).rejects.toThrow();expect(f.tx.replace).not.toHaveBeenCalled();
});

it('rejects an inexact plan digest and source revocation without reading a key during review',async()=>{
 const f=fixture(),reviewer={userId:'reviewer',sessionId:'reviewer-session'};await f.store.save(id,0,actor,'synthetic');f.source.readKey.mockClear();await expect(f.store.review(id,0,'f'.repeat(64),reviewer)).rejects.toThrow();f.source.assertCurrent.mockRejectedValue(Error('synthetic revoked'));await expect(f.store.review(id,0,f.planDigest,reviewer)).rejects.toThrow();expect(f.source.readKey).not.toHaveBeenCalled();expect(f.tx.replace).not.toHaveBeenCalled();
});
it('previews exact setting targets and missing/saved artifact status without secrets, sessions or execution authority',async()=>{
 const f=fixture(),reviewer={userId:'reviewer',sessionId:'reviewer-session'},before=await f.store.preview(id,reviewer);expect(before).toMatchObject({reviewReady:false,executionAuthorized:false,settings:[{name:'SYNTHETIC',environment:'production',artifactStatus:'missing'}]});
 await f.store.save(id,0,actor,'PRIVATE SYNTHETIC VALUE');f.source.readKey.mockClear();const after=await f.store.preview(id,reviewer);expect(after).toMatchObject({planDigest:f.planDigest,reviewReady:true,settings:[{artifactStatus:'saved'}]});const text=JSON.stringify(after);expect(text).not.toContain('PRIVATE SYNTHETIC VALUE');expect(text).not.toContain('v2.');expect(text).not.toContain(actor.sessionId);expect(f.source.readKey).not.toHaveBeenCalled();
});

it('refuses preview when source qualification changes during the artifact read',async()=>{
 const f=fixture();f.tx.readSettingsArtifact.mockImplementation(async()=>{f.source.assertCurrent.mockRejectedValue(Error('synthetic revoked'));return null});await expect(f.store.preview(id,{userId:'reviewer',sessionId:'reviewer-session'})).rejects.toThrow();
});

it('lets only the original requester claim a fully reviewed create-only action once without reading custody',async()=>{
 const f=fixture(),reviewer={userId:'reviewer',sessionId:'reviewer-session'};await f.store.save(id,0,actor,'synthetic');await f.store.review(id,0,f.planDigest,reviewer);f.source.readKey.mockClear();await expect(f.store.claim(id,1,f.planDigest,reviewer)).rejects.toThrow();expect(await f.store.claim(id,1,f.planDigest,actor)).toMatchObject({status:'claimed',attemptCount:1,executionAuthorized:false});await expect(f.store.claim(id,1,f.planDigest,actor)).rejects.toThrow();expect(f.source.readKey).not.toHaveBeenCalled();
});

it('holds existing-setting updates and refuses expired/revoked/missing-artifact claims before custody',async()=>{
 for(const mode of ['present','expiry','revoked','missing']as const){const f=fixture(mode==='present'),reviewer={userId:'reviewer',sessionId:'reviewer-session'};await f.store.save(id,0,actor,'synthetic');await f.store.review(id,0,f.planDigest,reviewer);f.source.readKey.mockClear();if(mode==='expiry')f.setClock(now+60000);if(mode==='revoked')f.revoke();if(mode==='missing')f.rows.clear();await expect(f.store.claim(id,1,f.planDigest,actor)).rejects.toThrow('settings_artifact_unavailable');expect(f.source.readKey).not.toHaveBeenCalled()}
});
