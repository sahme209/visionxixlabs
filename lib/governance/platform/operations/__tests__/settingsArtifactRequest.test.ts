import {it,expect,vi} from 'vitest';
import {createSettingsArtifactRequestComposition} from '../settingsArtifactRequest';
import type {SettingsArtifactTransaction} from '../settingsArtifactStore';
it('rejects bad possession before database lookup and rechecks possession before custody or review',async()=>{
 const unused=async():Promise<never>=>{throw Error('unused fixture port')};
 const readSessionPrincipal=vi.fn(async(sessionId:string)=>({userId:'admin',sessionId})),readPrincipal=vi.fn(async(p:{userId:string;sessionId:string})=>({...p,email:'admin@example.test',live:true}));
 const tx:SettingsArtifactTransaction={lock:async()=>{},readSessionPrincipal,readPrincipal,readGrowthPostingSource:unused,now:unused,read:unused,insert:unused,replace:unused,event:unused,readEffect:unused,writeEffect:unused,assertSettingsCreationHeld:unused,reserveSettingsCreation:unused,readSettingsArtifact:unused,insertSettingsArtifact:unused};
 const repo={transaction:<T>(fn:(t:SettingsArtifactTransaction)=>Promise<T>)=>fn(tx)},source={readManifest:vi.fn(unused),assertCurrent:unused,readKey:vi.fn(unused)},headers=new Headers({authorization:'Bearer invalid'});
 const ports={repo,source,readAdminEmails:()=>['admin@example.test'],verifyDesktopToken:(token:string)=>{if(token!=='valid')throw Error('bad signature');return{sessionId:'paired'}}};
 await expect(createSettingsArtifactRequestComposition({headers},ports)).rejects.toThrow();expect(readSessionPrincipal).not.toHaveBeenCalled();
 headers.set('authorization','Bearer valid');const api=await createSettingsArtifactRequestComposition({headers},ports);headers.delete('authorization');await expect(api.save('platform_action_11111111-1111-4111-8111-111111111111',0,'synthetic')).rejects.toThrow();await expect(api.review('platform_action_11111111-1111-4111-8111-111111111111',0,'a'.repeat(64))).rejects.toThrow();expect(source.readKey).not.toHaveBeenCalled();expect(source.readManifest).not.toHaveBeenCalled();
 headers.set('authorization','Bearer valid');readPrincipal.mockImplementation(async p=>{headers.delete('authorization');return {...p,email:'admin@example.test',live:true}});await expect(createSettingsArtifactRequestComposition({headers},ports)).rejects.toThrow();
});
