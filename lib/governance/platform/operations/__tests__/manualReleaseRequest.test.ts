import {it,expect,vi} from 'vitest';
import {createManualReleaseRequestComposition} from '../manualReleaseRequest';
import type {ManualReleaseRepository,ManualReleaseTransaction} from '../manualReleaseStore';
it('refuses invalid possession before SQL and rechecks bound possession around current authority',async()=>{
 const readSessionPrincipal=vi.fn(async(sessionId:string)=>({sessionId,userId:'admin'})),readPrincipal=vi.fn(async(p:{sessionId:string;userId:string})=>({...p,email:'admin@example.test',live:true}));
 const tx={lock:async()=>{},readSessionPrincipal,readPrincipal} as unknown as ManualReleaseTransaction;
 const repo:ManualReleaseRepository={transaction:fn=>fn(tx)},verifyDesktopToken=(token:string)=>{if(token!=='valid')throw Error('signature');return {sessionId:'paired'}};
 const source={readTimeWindow:async()=>{throw Error('unqualified')},buildCurrentManifest:vi.fn(async()=>{throw Error('unqualified')}),assertCurrent:async()=>{throw Error('unqualified')}};
 const ports={clock:async()=>({earliest:0,latest:0}),repo,source,verifyDesktopToken,readAdminEmails:()=>['admin@example.test']},headers=new Headers({authorization:'Bearer invalid'});
 await expect(createManualReleaseRequestComposition({headers},ports)).rejects.toThrow();expect(readSessionPrincipal).not.toHaveBeenCalled();
 headers.set('authorization','Bearer valid');const api=await createManualReleaseRequestComposition({headers},ports);await expect(api.inspectResult('platform_manual_release_11111111-1111-4111-8111-111111111111','dpl_fixture')).rejects.toThrow();headers.delete('authorization');await expect(api.prepare({},'33333333-3333-4333-8333-333333333333')).rejects.toThrow();expect(source.buildCurrentManifest).not.toHaveBeenCalled();
 headers.set('authorization','Bearer valid');readPrincipal.mockImplementation(async p=>{headers.delete('authorization');return {...p,email:'admin@example.test',live:true}});await expect(createManualReleaseRequestComposition({headers},ports)).rejects.toThrow();
});
