import {afterEach,it,expect,vi} from 'vitest';
import {createBranch,createPullRequest} from '../githubWriteClient';
afterEach(()=>vi.unstubAllGlobals());
const args={owner:'owner',repo:'repo',installationToken:'SIMULATED',beforeWrite:async()=>{}};
it.each(['branch','pull_request'])('checks sync intent before the sole %s POST',async kind=>{
 const order:string[]=[];vi.stubGlobal('fetch',vi.fn(async(_url:any,init:any)=>{if(init.method==='GET')return Response.json({object:{type:'commit',sha:'a'.repeat(40)}});order.push('POST');return kind==='branch'?Response.json({ref:'refs/heads/work',object:{sha:'a'.repeat(40)}}):Response.json({number:42,html_url:'https://github.com/owner/repo/pull/42'})}));
 const authority={...args,beforeWrite:async()=>{await Promise.resolve();order.push('authority')},beforeFetch:()=>{order.push('intent')}};
 const result=kind==='branch'?await createBranch({...authority,baseBranch:'main',newBranchName:'work',expectedBaseSha:'a'.repeat(40)}):await createPullRequest({...authority,head:'work',base:'main',title:'Reviewed'});
 expect(result.ok).toBe(true);expect(order).toEqual(['authority','intent','POST']);
});
it.each(['branch','pull_request'])('refuses expired %s intent without POST',async kind=>{
 let posts=0;vi.stubGlobal('fetch',vi.fn(async(_url:any,init:any)=>{if(init.method==='GET')return Response.json({object:{type:'commit',sha:'a'.repeat(40)}});posts++;return Response.json({})}));
 const authority={...args,beforeFetch:()=>{throw Error('expired')}};
 const result=kind==='branch'?await createBranch({...authority,baseBranch:'main',newBranchName:'work'}):await createPullRequest({...authority,head:'work',base:'main',title:'Reviewed'});expect(result.ok).toBe(false);expect(posts).toBe(0);
});
