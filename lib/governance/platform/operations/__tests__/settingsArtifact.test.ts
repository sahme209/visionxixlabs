import {it,expect} from 'vitest';
import {randomBytes,createHash} from 'node:crypto';
import {compileOperationalManifest} from '../kernel';
import {createPlatformAction} from '../../kernel';
import {compileOperationalSettingsPlan,deriveSettingsArtifactBinding,sealSettingsArtifact,openSettingsArtifact,settingsArtifactMetadata} from '../settingsArtifact';
const at=Date.parse('2026-11-12T00:00:00Z'),creator={userId:'creator',sessionId:'creator-session'},id='platform_action_11111111-1111-4111-8111-111111111111',artifact='platform_artifact_11111111-1111-4111-8111-111111111111',ref='platform_evidence_11111111-1111-4111-8111-111111111111';
function fixture(){const manifest=compileOperationalManifest({format:1,scope:'platform',kind:'settings.vercel',artifactProfileId:'synthetic-private-profile',expiresAt:new Date(at+60000).toISOString(),target:{projectId:'project',teamId:'team'},settings:[{name:'SYNTHETIC_SECRET',environment:'production',type:'encrypted',sensitivity:'secret',artifactId:artifact,current:{kind:'absent',receiptId:ref}}]});if(manifest.kind!=='settings.vercel')throw Error('fixture');const plan=compileOperationalSettingsPlan(manifest),parent=createPlatformAction(plan,creator,at),binding=deriveSettingsArtifactBinding(id,parent,manifest,0,creator);return {manifest,plan,parent,binding,key:randomBytes(32)}}
it('encrypts only into a private envelope while public plan/metadata contain no value, ciphertext or public secret hash',()=>{
 const f=fixture(),plain='SYNTHETIC_SECRET_DO_NOT_EXPOSE',cipher=sealSettingsArtifact(f.key,f.binding,plain);expect(openSettingsArtifact(f.key,f.binding,cipher)).toBe(plain);
 const publicData=JSON.stringify({plan:f.plan,metadata:settingsArtifactMetadata(f.binding)});expect(publicData).not.toContain(plain);expect(publicData).not.toContain(cipher);expect(publicData).not.toContain(createHash('sha256').update(plain).digest('hex'));expect(publicData).not.toContain(creator.sessionId);expect(settingsArtifactMetadata(f.binding)).toMatchObject({artifactId:artifact,profileId:'synthetic-private-profile',authority:'metadata_only',executionAuthorized:false});
});
it('refuses ciphertext copied to a different action, actor/session, project/team, setting/environment, effect, artifact or profile',()=>{
 const f=fixture(),cipher=sealSettingsArtifact(f.key,f.binding,'synthetic secret');
 const variants=[{...f.binding,actionId:'platform_action_22222222-2222-4222-8222-222222222222'},{...f.binding,creator:{...creator,userId:'other'}},{...f.binding,creator:{...creator,sessionId:'other'}},{...f.binding,target:{...f.binding.target,projectId:'other'}},{...f.binding,target:{...f.binding.target,teamId:'other'}},{...f.binding,target:{...f.binding.target,name:'OTHER_SECRET'}},{...f.binding,target:{...f.binding.target,environment:'preview'}},{...f.binding,effectIndex:1},{...f.binding,artifactId:'platform_artifact_22222222-2222-4222-8222-222222222222'},{...f.binding,profileId:'other-profile'}];
 for(const changed of variants)expect(()=>openSettingsArtifact(f.key,changed,cipher)).toThrow('settings_artifact_unavailable');expect(()=>openSettingsArtifact(randomBytes(32),f.binding,cipher)).toThrow();
});
it('derives binding only from the exact canonical metadata plan and original creator',()=>{
 const f=fixture();expect(()=>deriveSettingsArtifactBinding(id,f.parent,f.manifest,1,creator)).toThrow();expect(()=>deriveSettingsArtifactBinding(id,f.parent,f.manifest,0,{...creator,userId:'reviewer'})).toThrow();expect(()=>deriveSettingsArtifactBinding(id,{...f.parent,plan:{...f.plan,digest:'f'.repeat(64)}},f.manifest,0,creator)).toThrow();
});
it('rejects missing/wrong keys, malformed/oversized envelopes and invalid or over-budget UTF-8 values with fixed errors',()=>{
 const f=fixture(),cipher=sealSettingsArtifact(f.key,f.binding,'synthetic');for(const key of [undefined,{},randomBytes(31)])expect(()=>openSettingsArtifact(key,f.binding,cipher)).toThrow('settings_artifact_unavailable');
 for(const bad of ['v1.'+cipher.slice(3),cipher+'=',cipher.slice(0,-1),'v2.'+'A'.repeat(100000)])expect(()=>openSettingsArtifact(f.key,f.binding,bad)).toThrow('settings_artifact_unavailable');
 for(const bad of ['x'.repeat(65537),'€'.repeat(22000),'bad\u0000value','\ud800'])expect(()=>sealSettingsArtifact(f.key,f.binding,bad)).toThrow('settings_artifact_unavailable');
});
it('preserves exact multiline and empty values without exposing plaintext-dependent metadata',()=>{
 const f=fixture(),metadata=settingsArtifactMetadata(f.binding);for(const value of ['', 'line one\nline two\n','valid 😀']){const sealed=sealSettingsArtifact(f.key,f.binding,value);expect(openSettingsArtifact(f.key,f.binding,sealed)).toBe(value);expect(settingsArtifactMetadata(f.binding)).toEqual(metadata)}
});
