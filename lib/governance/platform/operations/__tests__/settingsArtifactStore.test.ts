import {it,expect,vi} from 'vitest';
import {randomBytes} from 'node:crypto';
import {compileOperationalManifest} from '../kernel';
import {createPlatformAction} from '../../kernel';
import {compileOperationalSettingsPlan} from '../settingsArtifact';
import {createSettingsArtifactStore} from '../settingsArtifactStore';
const now=Date.parse('2026-11-12T00:00:00Z'),actor={userId:'creator',sessionId:'session'},id='platform_action_11111111-1111-4111-8111-111111111111';
function fixture(){
 const manifest=compileOperationalManifest({format:1,scope:'platform',kind:'settings.vercel',artifactProfileId:'synthetic-profile',expiresAt:new Date(now+60000).toISOString(),target:{projectId:'project',teamId:'team'},settings:[{name:'SYNTHETIC',environment:'production',type:'encrypted',sensitivity:'secret',artifactId:'platform_artifact_11111111-1111-4111-8111-111111111111',current:{kind:'absent',receiptId:'platform_evidence_11111111-1111-4111-8111-111111111111'}}]});
 let parent=createPlatformAction(compileOperationalSettingsPlan(manifest),actor,now),clock=now,revoked=false;const rows=new Map<string,unknown>();
 const unused=async():Promise<never>=>{throw Error('unused fixture port')};
 const tx={readGrowthPostingSource:unused,readSessionPrincipal:unused,readPrincipal:unused,insert:unused,replace:unused,event:unused,readEffect:unused,writeEffect:unused,lock:vi.fn(async()=>{}),read:async()=>parent,now:async()=>clock,readSettingsArtifact:async(key:string)=>rows.get(key)??null,insertSettingsArtifact:vi.fn(async(key:string,row:unknown)=>{if(rows.has(key))throw Error('duplicate');rows.set(key,row)})};
 const authority={assertCurrent:vi.fn(async()=>{if(revoked)throw Error('private detail')})},key=randomBytes(32),source={readManifest:vi.fn(async()=>manifest),assertCurrent:vi.fn(async()=>{}),readKey:vi.fn(async()=>key)};
 const repo={transaction:async<T>(fn:(t:typeof tx)=>Promise<T>)=>{const before=new Map(rows);try{return await fn(tx)}catch(e){rows.clear();for(const [k,v]of before)rows.set(k,v);throw e}}};
 return {store:createSettingsArtifactStore(repo,authority,source),tx,rows,source,key,setClock:(v:number)=>{clock=v},revoke:()=>{revoked=true},approve:()=>{parent={...parent,status:'approved',version:1}}};
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
