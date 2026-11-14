import {afterEach,expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createSettingsExecutor} from '../settingsExecution';
import {createSettingsVercelTransport} from '../settingsVercelTransport';
import type {ExecutionTimeAuthorization} from '../../executionTime';
import {createSettingsPreparationStore} from '../settingsPreparation';
import {createSettingsArtifactStore,type SettingsArtifactRepository,type SettingsArtifactTransaction} from '../settingsArtifactStore';
import {compileOperationalManifest} from '../kernel';
import type {PlatformAction,PlatformPrincipal} from '../../contracts';
const at=Date.parse('2026-11-12T00:00:00Z'),actor={userId:'requester',sessionId:'requester-session'},reviewer={userId:'reviewer',sessionId:'reviewer-session'};
function fixture(){
 const manifest=compileOperationalManifest({format:1,scope:'platform',kind:'settings.vercel',artifactProfileId:'synthetic-profile',expiresAt:new Date(at+60000).toISOString(),target:{projectId:'project',teamId:'team'},settings:[{name:'SYNTHETIC',environment:'production',type:'encrypted',sensitivity:'secret',artifactId:'platform_artifact_'+randomUUID(),current:{kind:'absent',receiptId:'platform_evidence_'+randomUUID()}}]});if(manifest.kind!=='settings.vercel')throw Error('fixture');
 let parents=new Map<string,PlatformAction>(),artifacts=new Map<string,unknown>(),manifests=new Map<string,unknown>(),events:unknown[]=[],children=new Map<string,string>(),holds=new Set<string>(),queue=Promise.resolve(),now=at,depth=0,loseCommitOnce=false;
 const controller=new AbortController(),clock=vi.fn(async()=>({earliest:at,latest:at+1})),expiry=new Map([[actor.userId,at+120000],[reviewer.userId,at+120000]]),allowed=new Set([actor.userId,reviewer.userId]);
 const readTimeWindow=vi.fn(async(_tx:SettingsArtifactTransaction,context:{manifestDigest:string;profileId:string})=>({manifestDigest:context.manifestDigest,profileId:context.profileId,notBefore:at-1000,expiresAt:at+60000})),readKey=vi.fn(async()=>Buffer.alloc(32,7));
 const source={readTimeWindow,readKey,assertWriteProfile:vi.fn(async()=>{}),assertCurrent:vi.fn(async()=>{}),readManifest:async(_tx:SettingsArtifactTransaction,id:string)=>manifests.get(id)};
 const authority={assertCurrent:vi.fn(async(_tx:SettingsArtifactTransaction,p:PlatformPrincipal)=>{if(!allowed.has(p.userId))throw Error('revoked')})};
 const repo:SettingsArtifactRepository={transaction:async fn=>{const previous=queue;let release!:()=>void;queue=new Promise(r=>{release=r});await previous;const next=new Map(parents),saved=new Map(artifacts),native=new Map(manifests),log=[...events],childRows=new Map(children),held=new Set(holds);
  const unused=async():Promise<never>=>{throw Error('unused')};
  const tx:SettingsArtifactTransaction={lock:async()=>{},now:async()=>now,read:async id=>next.get(id)??null,insert:async(id,state)=>{if(next.has(id))throw Error('duplicate');next.set(id,state)},replace:async(id,version,state)=>{if(next.get(id)?.version!==version)throw Error('version');next.set(id,state)},event:async event=>{log.push(event);if(event.settingsManifest)native.set(event.actionId,event.settingsManifest)},readEffect:async(id,index)=>childRows.get(id+':'+index)??null,writeEffect:async(id,index,expected,status)=>{const key=id+':'+index;if((childRows.get(key)??null)!==expected)throw Error('child version');childRows.set(key,status)},readSessionPrincipal:async sessionId=>sessionId===actor.sessionId?actor:sessionId===reviewer.sessionId?reviewer:null,readPrincipal:async p=>({...p,email:p.userId+'@example.test',live:allowed.has(p.userId),sessionIssuedAtMs:at-1000,sessionExpiresAtMs:expiry.get(p.userId)}),readGrowthPostingSource:unused,readSettingsManifest:async id=>native.get(id),readSettingsResults:async()=>[],assertSettingsCreationHeld:async binding=>{if(!held.has(binding.artifactId))throw Error('hold missing')},reserveSettingsCreation:async binding=>{if(held.has(binding.artifactId))throw Error('already held');held.add(binding.artifactId);return binding.artifactId},readSettingsArtifact:async id=>saved.get(id)??null,insertSettingsArtifact:async(id,row)=>{if(saved.has(id))throw Error('duplicate');saved.set(id,row)}};
  try{depth++;const result=await fn(tx);parents=next;artifacts=saved;manifests=native;events=log;children=childRows;holds=held;if(loseCommitOnce){loseCommitOnce=false;throw Error('committed_ack_unknown')}return result}finally{depth--;release()}
 }};
 const timing={clock,signal:controller.signal},preparation=createSettingsPreparationStore(repo,authority,source,timing),store=createSettingsArtifactStore(repo,authority,source,timing);
 async function proposed(){const {digest:_,authority:_authority,executionAuthorized:_execution,...raw}=manifest;const requestId=randomUUID(),p=await preparation.prepare(raw,requestId,actor);return {requestId,id:p.actionId,digest:parents.get(p.actionId)!.plan.digest}}
 async function saved(){const p=await proposed();await store.save(p.id,0,actor,'synthetic private fixture');return p}
 async function executable(){const p=await saved();await store.review(p.id,0,p.digest,reviewer);await store.claim(p.id,1,p.digest,actor);readKey.mockClear();return p}
 function native(){
  const credential=vi.fn(async()=>({token:'SYNTHETIC_TOKEN',notBefore:at-1000,expiresAt:at+30000})),qualified=vi.fn(async()=>{}),credentialCurrent=vi.fn(async()=>{}),dispatchCurrent=vi.fn(async()=>{}),fetch=vi.fn(async()=>new Response(JSON.stringify({created:{id:'new-id',key:'SYNTHETIC',target:['production'],type:'sensitive',visibility:'secret'},failed:[]}),{status:201})),ports={clock,signal:controller.signal,readCredential:credential,assertQualified:qualified,assertCredentialCurrent:credentialCurrent,assertDispatchCurrent:dispatchCurrent,fetch},transport=Reflect.apply(createSettingsVercelTransport,null,[ports]) as ReturnType<typeof createSettingsVercelTransport>;
  return {credential,qualified,credentialCurrent,dispatchCurrent,fetch,ports,transport};
 }
 function executor(transport:Parameters<typeof createSettingsExecutor>[3],config:import('../settingsTime').SettingsTiming=timing){return Reflect.apply(createSettingsExecutor,null,[repo,authority,source,transport,config]) as ReturnType<typeof createSettingsExecutor>}
 return {manifest,repo,authority,source,clock,depth:()=>depth,loseCommitAckOnce:()=>{loseCommitOnce=true},native,executor,executable,timing,controller,expiry,allowed,preparation,store,proposed,saved,parents:()=>parents,artifacts:()=>artifacts,events:()=>events,setNow:(v:number)=>{now=v}};
}
afterEach(()=>vi.unstubAllEnvs());
it('refuses new preparation when the actual requester interval is expired despite database liveness',async()=>{const f=fixture();f.expiry.set(actor.userId,at+1);await expect(f.proposed()).rejects.toThrow();expect(f.parents().size).toBe(0)});
it('checks interval expiry before reading artifact custody or inserting an envelope',async()=>{const f=fixture(),p=await f.proposed();f.clock.mockResolvedValue({earliest:at+59999,latest:at+60000});await expect(f.store.save(p.id,0,actor,'synthetic')).rejects.toThrow();expect(f.source.readKey).not.toHaveBeenCalled();expect(f.artifacts().size).toBe(0)});
it('checks the actual prospective reviewer before recording independent approval',async()=>{const f=fixture(),p=await f.saved();f.expiry.set(reviewer.userId,at+1);await expect(f.store.review(p.id,0,p.digest,reviewer)).rejects.toThrow();expect(f.parents().get(p.id)?.status).toBe('proposed')});
it('checks the private metadata preview reader without reading a key',async()=>{const f=fixture(),p=await f.proposed();f.expiry.set(reviewer.userId,at+1);await expect(f.store.preview(p.id,reviewer)).rejects.toThrow();expect(f.source.readKey).not.toHaveBeenCalled()});
it('refuses expired reviewed people before the original requester claim',async()=>{const f=fixture(),p=await f.saved();await f.store.review(p.id,0,p.digest,reviewer);f.expiry.set(reviewer.userId,at+1);await expect(f.store.claim(p.id,1,p.digest,actor)).rejects.toThrow();expect(f.parents().get(p.id)).toMatchObject({status:'approved',attemptCount:0})});
it('rejects future or substituted private source-window evidence before custody',async()=>{for(const mode of ['future','binding'] as const){const f=fixture(),p=await f.proposed();f.source.readTimeWindow.mockImplementation(async(_tx,context)=>({...context,manifestDigest:mode==='binding'?'a'.repeat(64):context.manifestDigest,notBefore:mode==='future'?at+1:at-1000,expiresAt:at+60000}));await expect(f.store.save(p.id,0,actor,'synthetic')).rejects.toThrow();expect(f.source.readKey).not.toHaveBeenCalled()}});
it('rechecks exact source and role after the clock await and leaves no new artifact',async()=>{for(const mode of ['role','source']as const){const f=fixture(),p=await f.proposed();f.clock.mockImplementation(async()=>{if(mode==='role')f.allowed.delete(actor.userId);else f.source.assertCurrent.mockRejectedValue(Error('source revoked'));return {earliest:at,latest:at+1}});await expect(f.store.save(p.id,0,actor,'synthetic')).rejects.toThrow();expect(f.artifacts().size).toBe(0)}});
it('requires the original controlling signal before live custody',async()=>{const f=fixture(),p=await f.proposed();f.controller.abort();await expect(f.store.save(p.id,0,actor,'synthetic')).rejects.toThrow();expect(f.source.readKey).not.toHaveBeenCalled()});
it('joins actual preparation, private crypto save, prospective preview, review and claim without exposing values',async()=>{const f=fixture(),p=await f.saved(),view=await f.store.preview(p.id,reviewer);expect(view).toMatchObject({reviewReady:true,executionAuthorized:false});expect(JSON.stringify(view)).not.toContain('synthetic private fixture');await f.store.review(p.id,0,p.digest,reviewer);await f.store.claim(p.id,1,p.digest,actor);expect(f.parents().get(p.id)).toMatchObject({status:'claimed',attemptCount:1});expect(f.source.readKey).toHaveBeenCalledTimes(1)});

it('history and original reference recovery do not request new source time or read custody',async()=>{
 const f=fixture(),p=await f.saved();await f.store.review(p.id,0,p.digest,reviewer);f.expiry.set(actor.userId,at+240000);f.setNow(at+120000);f.source.assertCurrent.mockRejectedValue(Error('old source unavailable'));f.clock.mockRejectedValue(Error('native source unavailable'));f.source.readTimeWindow.mockClear();f.source.readKey.mockClear();
 const oldStore=createSettingsArtifactStore(f.repo,f.authority,f.source),oldPreparation=createSettingsPreparationStore(f.repo,f.authority,f.source),{digest:_,authority:_authority,executionAuthorized:_execution,...raw}=f.manifest;
 expect(await oldStore.inspect(p.id,actor)).toMatchObject({status:'approved',expired:true,authority:'history_only',executionAuthorized:false});expect(await oldPreparation.lookup(p.requestId,actor)).toMatchObject({found:true,actionId:p.id});expect(await oldPreparation.prepare(raw,p.requestId,actor)).toMatchObject({historical:true,actionId:p.id});expect(f.source.readTimeWindow).not.toHaveBeenCalled();expect(f.source.readKey).not.toHaveBeenCalled();
});
it('omitted clock or exact source-window supplier cannot access private custody',async()=>{
 const f=fixture(),p=await f.proposed();for(const mode of ['clock','source']as const){const source={...f.source,...(mode==='source'?{readTimeWindow:undefined}:{})},store=createSettingsArtifactStore(f.repo,f.authority,source,mode==='clock'?undefined:f.timing);await expect(store.save(p.id,0,actor,'synthetic')).rejects.toThrow();expect(f.source.readKey).not.toHaveBeenCalled()}
});
it('does not accept a source validity window replaced during the clock await',async()=>{
 const f=fixture(),p=await f.proposed();f.clock.mockImplementation(async()=>{f.source.readTimeWindow.mockImplementation(async(_tx,context)=>({...context,notBefore:at-1000,expiresAt:at+1}));return {earliest:at,latest:at+1}});await expect(f.store.save(p.id,0,actor,'synthetic')).rejects.toThrow();expect(f.source.readKey).not.toHaveBeenCalled();expect(f.artifacts().size).toBe(0);
});

it('binds the same private policy through actual request preparation, custody, prospective review and claim',async()=>{
 const {createSettingsArtifactRequestComposition}=await import('../settingsArtifactRequest'),f=fixture(),headers=new Headers({authorization:'Bearer requester-session'}),ports={repo:f.repo,source:f.source,preparationSource:f.source,clock:f.clock,verifyDesktopToken:(token:string)=>({sessionId:token}),readAdminEmails:()=>['requester@example.test','reviewer@example.test']},requester=await createSettingsArtifactRequestComposition({headers,signal:f.controller.signal},ports),{digest:_,authority:_authority,executionAuthorized:_execution,...raw}=f.manifest,p=await requester.prepare(raw,randomUUID());
 await requester.save(p.actionId,0,'synthetic request value');const independent=await createSettingsArtifactRequestComposition({headers:new Headers({authorization:'Bearer reviewer-session'}),signal:f.controller.signal},ports),preview=await independent.preview(p.actionId);await independent.review(p.actionId,0,preview.planDigest);await requester.claim(p.actionId,1,preview.planDigest);expect(f.parents().get(p.actionId)).toMatchObject({status:'claimed',attemptCount:1});expect(f.source.readKey).toHaveBeenCalledTimes(1);
});
it('rechecks original bearer possession after the private clock await before reading custody',async()=>{
 const {createSettingsArtifactRequestComposition}=await import('../settingsArtifactRequest'),f=fixture(),p=await f.proposed(),headers=new Headers({authorization:'Bearer requester-session'}),ports={repo:f.repo,source:f.source,clock:f.clock,verifyDesktopToken:(token:string)=>({sessionId:token}),readAdminEmails:()=>['requester@example.test','reviewer@example.test']},requester=await createSettingsArtifactRequestComposition({headers,signal:f.controller.signal},ports);
 f.clock.mockImplementation(async()=>{headers.set('authorization','Bearer reviewer-session');return {earliest:at,latest:at+1}});await expect(requester.save(p.id,0,'synthetic')).rejects.toThrow();expect(f.source.readKey).not.toHaveBeenCalled();expect(f.artifacts().size).toBe(0);
});
it('rechecks source evidence and time after awaited key delivery',async()=>{
 const f=fixture(),p=await f.proposed();f.source.readKey.mockImplementation(async()=>{f.clock.mockResolvedValue({earliest:at+60000,latest:at+60001});return Buffer.alloc(32,7)});await expect(f.store.save(p.id,0,actor,'synthetic')).rejects.toThrow();expect(f.artifacts().size).toBe(0);
});

it('refuses expired execution before opening the private settings value',async()=>{
 const f=fixture(),p=await f.executable(),n=f.native();f.clock.mockResolvedValue({earliest:at+60000,latest:at+60001});await expect(f.executor(n.transport).executeNext(p.id,actor,0)).rejects.toThrow();expect(f.source.readKey).not.toHaveBeenCalled();expect(n.credential).not.toHaveBeenCalled();expect(n.fetch).not.toHaveBeenCalled();
});
it('refuses mismatched policy or cancelled execution before key access',async()=>{
 for(const mode of ['clock','cancel']as const){const f=fixture(),p=await f.executable(),n=f.native();if(mode==='cancel')f.controller.abort();const config=mode==='clock'?{...f.timing,clock:async()=>({earliest:at,latest:at+1})}:f.timing;await expect(f.executor(n.transport,config).executeNext(p.id,actor,0)).rejects.toThrow();expect(f.source.readKey).not.toHaveBeenCalled();expect(n.fetch).not.toHaveBeenCalled()}
});
it('rechecks the current people after native profile waits before acquiring a credential',async()=>{
 const f=fixture(),p=await f.executable(),n=f.native();n.qualified.mockImplementation(async()=>{f.allowed.delete(reviewer.userId)});await expect(f.executor(n.transport).executeNext(p.id,actor,0)).rejects.toThrow();expect(n.credential).not.toHaveBeenCalled();expect(n.fetch).not.toHaveBeenCalled();
});
it('joins actual stores, crypto, executor, child coordinator and intercepted settings HTTP once',async()=>{
 const f=fixture(),p=await f.executable(),n=f.native(),result=await f.executor(n.transport).executeNext(p.id,actor,0);expect(result).toMatchObject({actionId:p.id,effectIndex:0,settingId:'new-id',deploymentPerformed:false});expect(f.parents().get(p.id)).toMatchObject({status:'confirmed',attemptCount:1});expect(n.fetch).toHaveBeenCalledTimes(1);expect(n.credential).toHaveBeenCalledTimes(1);expect(f.source.readKey).toHaveBeenCalledTimes(1);expect(JSON.stringify(result)).not.toContain('synthetic private fixture');
});
it('an omitted native time check cannot consume the send proof or reach the synthetic outbound operation',async()=>{
 const f=fixture(),p=await f.executable();let sends=0;
 const transport={clock:f.clock,signal:f.controller.signal,send:async(_binding:unknown,_value:string,before:ExecutionTimeAuthorization)=>{await before();sends++;return {outcome:'confirmed',settingId:'must-not-send'}}};await expect(f.executor(transport).executeNext(p.id,actor,0)).rejects.toThrow();expect(sends).toBe(0);expect(f.parents().get(p.id)).toMatchObject({status:'unknown',attemptCount:1});
});

it('keeps authorization time inside the owner and adds exactly two original-proof postcommit dispatch checks',async()=>{
 const f=fixture(),p=await f.executable(),n=f.native();let outside=0;f.clock.mockImplementation(async()=>{if(f.depth()===0)outside++;return {earliest:at,latest:at+1}});await f.executor(n.transport).executeNext(p.id,actor,0);expect(n.fetch).toHaveBeenCalledTimes(1);expect(outside).toBe(2);
});

it('credential expiry/not-before refusal preserves the original unknown attempt without an HTTP write',async()=>{
 for(const mode of ['expired','future']as const){const f=fixture(),p=await f.executable(),n=f.native();n.credential.mockResolvedValue({token:'SYNTHETIC_TOKEN',notBefore:mode==='future'?at+1:at-1000,expiresAt:mode==='expired'?at+1:at+30000});await expect(f.executor(n.transport).executeNext(p.id,actor,0)).rejects.toThrow();expect(n.fetch).not.toHaveBeenCalled();expect(f.parents().get(p.id)).toMatchObject({status:'unknown',attemptCount:1});await expect(f.executor(n.transport).executeNext(p.id,actor,0)).rejects.toThrow();expect(n.credential).toHaveBeenCalledTimes(1)}
});
it('revoked held credentials after the final clock await cannot reach HTTP',async()=>{
 const f=fixture(),p=await f.executable(),n=f.native();let acquired=false;n.credential.mockImplementation(async()=>{acquired=true;return {token:'SYNTHETIC_TOKEN',notBefore:at-1000,expiresAt:at+30000}});f.clock.mockImplementation(async()=>{if(acquired)n.credentialCurrent.mockRejectedValue(Error('held credential revoked'));return {earliest:at,latest:at+1}});await expect(f.executor(n.transport).executeNext(p.id,actor,0)).rejects.toThrow();expect(n.fetch).not.toHaveBeenCalled();expect(f.parents().get(p.id)?.status).toBe('unknown');
});
it('lost final commit acknowledgment withholds HTTP and leaves one unknown attempt',async()=>{
 const f=fixture(),p=await f.executable(),n=f.native();n.credentialCurrent.mockImplementation(async()=>{if(f.depth()>0)f.loseCommitAckOnce()});await expect(f.executor(n.transport).executeNext(p.id,actor,0)).rejects.toThrow();expect(n.fetch).not.toHaveBeenCalled();expect(f.parents().get(p.id)).toMatchObject({status:'unknown',attemptCount:1});await expect(f.executor(n.transport).executeNext(p.id,actor,0)).rejects.toThrow();expect(f.source.readKey).toHaveBeenCalledTimes(1);
});

it('binds the guarded request clock to the actual native transport factory and exact child execution',async()=>{
 const {createSettingsArtifactRequestComposition}=await import('../settingsArtifactRequest'),f=fixture(),p=await f.executable(),n=f.native(),headers=new Headers({authorization:'Bearer requester-session'}),factory=vi.fn((timing:import('../settingsTime').SettingsTiming)=>createSettingsVercelTransport({...n.ports,...timing}));
 const request=await createSettingsArtifactRequestComposition({headers,signal:f.controller.signal},{repo:f.repo,source:f.source,clock:f.clock,verifyDesktopToken:token=>({sessionId:token}),readAdminEmails:()=>['requester@example.test','reviewer@example.test'],execution:{assertWriteProfile:f.source.assertWriteProfile,createTransport:factory}});
 expect(await request.executeNext(p.id,0)).toMatchObject({actionId:p.id,effectIndex:0,settingId:'new-id'});expect(factory).toHaveBeenCalledOnce();expect(factory.mock.calls[0][0].clock).not.toBe(f.clock);expect(n.fetch).toHaveBeenCalledOnce();expect(n.credential).toHaveBeenCalledOnce();await expect(request.executeNext(p.id,0)).rejects.toThrow();expect(n.fetch).toHaveBeenCalledOnce();
});
it('a bearer lost during native acquisition authorization stops before requesting credentials',async()=>{
 const {createSettingsArtifactRequestComposition}=await import('../settingsArtifactRequest'),f=fixture(),p=await f.executable(),n=f.native(),headers=new Headers({authorization:'Bearer requester-session'});
 n.qualified.mockImplementation(async()=>{headers.delete('authorization')});
 const request=await createSettingsArtifactRequestComposition({headers,signal:f.controller.signal},{repo:f.repo,source:f.source,clock:f.clock,verifyDesktopToken:token=>({sessionId:token}),readAdminEmails:()=>['requester@example.test','reviewer@example.test'],execution:{assertWriteProfile:f.source.assertWriteProfile,createTransport:timing=>createSettingsVercelTransport({...n.ports,...timing})}});
 await expect(request.executeNext(p.id,0)).rejects.toThrow();expect(n.credential).not.toHaveBeenCalled();expect(n.fetch).not.toHaveBeenCalled();expect(f.parents().get(p.id)).toMatchObject({status:'unknown',attemptCount:1});
});

it.each(['prepare','save','preview','review','claim'] as const)('refuses a source-window replacement in the final %s owner check and rolls back its decision',async phase=>{
 const f=fixture(),p=phase==='prepare'?undefined:phase==='save'?await f.proposed():await f.saved();
 if(phase==='claim')await f.store.review(p!.id,0,p!.digest,reviewer);
 const beforeEvents=f.events().length,beforeArtifacts=f.artifacts().size,beforeStatus=p?f.parents().get(p.id)?.status:null;
 f.clock.mockClear();let changed=false;const last={prepare:2,save:4,preview:1,review:2,claim:2}[phase];
 f.source.readTimeWindow.mockImplementation(async(_tx,context)=>{return {manifestDigest:context.manifestDigest,profileId:context.profileId,notBefore:at-1000,expiresAt:changed?at+1:at+60000}});
 f.source.assertCurrent.mockImplementation(async()=>{if(f.clock.mock.calls.length===last)changed=true});
 const operation=phase==='prepare'?f.proposed():phase==='save'?f.store.save(p!.id,0,actor,'synthetic'):phase==='preview'?f.store.preview(p!.id,reviewer):phase==='review'?f.store.review(p!.id,0,p!.digest,reviewer):f.store.claim(p!.id,1,p!.digest,actor);
 await expect(operation).rejects.toThrow();expect(changed).toBe(true);expect(f.events()).toHaveLength(beforeEvents);expect(f.artifacts().size).toBe(beforeArtifacts);
 if(p)expect(f.parents().get(p.id)?.status).toBe(beforeStatus);else expect(f.parents().size).toBe(0);
});
it('checks the final native settings source window before any HTTP and preserves one consumed unknown attempt',async()=>{
 const f=fixture(),p=await f.executable(),n=f.native();let afterNativeClock=false,changed=false;
 n.credentialCurrent.mockImplementation(async()=>{if(f.depth()>0)afterNativeClock=true});
 f.source.assertCurrent.mockImplementation(async()=>{if(afterNativeClock)changed=true});
 f.source.readTimeWindow.mockImplementation(async(_tx,c)=>({manifestDigest:c.manifestDigest,profileId:c.profileId,notBefore:at-1000,expiresAt:changed?at+1:at+60000}));
 await expect(f.executor(n.transport).executeNext(p.id,actor,0)).rejects.toThrow();expect(changed).toBe(true);expect(n.fetch).not.toHaveBeenCalled();expect(n.credential).toHaveBeenCalledOnce();expect(f.parents().get(p.id)).toMatchObject({status:'unknown',attemptCount:1});
 await expect(f.executor(n.transport).executeNext(p.id,actor,0)).rejects.toThrow();expect(n.fetch).not.toHaveBeenCalled();expect(n.credential).toHaveBeenCalledOnce();
});
it('refuses paired possession lost in the last settings source-window read',async()=>{
 const {createSettingsArtifactRequestComposition}=await import('../settingsArtifactRequest'),f=fixture(),p=await f.saved(),request=new Request('http://fixture.invalid',{headers:{authorization:'Bearer requester-session'},signal:f.controller.signal});let reads=0;
 const service=await createSettingsArtifactRequestComposition(request,{repo:f.repo,source:f.source,clock:f.clock,verifyDesktopToken:token=>({sessionId:token}),readAdminEmails:()=>['requester@example.test','reviewer@example.test']});
 f.source.readTimeWindow.mockImplementation(async(_tx,c)=>{if(++reads===2)request.headers.delete('authorization');return {manifestDigest:c.manifestDigest,profileId:c.profileId,notBefore:at-1000,expiresAt:at+60000}});
 await expect(service.preview(p.id)).rejects.toThrow();expect(f.parents().get(p.id)?.status).toBe('proposed');
});

it.each(['acquire','send'] as const)('native settings %s authority must survive the last owner source-window read',async phase=>{
 const f=fixture(),p=await f.executable(),n=f.native();let revoked=false,arm=false,q=0,c=0;const original=f.source.readTimeWindow.getMockImplementation()!;
 f.source.readTimeWindow.mockImplementation(async(tx,context)=>{const result=await original(tx,context);if(arm)revoked=true;return result});
 n.qualified.mockImplementation(async()=>{if(revoked)throw Error('native profile revoked at last source window');if(phase==='acquire'&&++q===2)arm=true});
 n.credentialCurrent.mockImplementation(async()=>{if(revoked)throw Error('native credential revoked');if(phase==='send'&&++c===2)arm=true});
 await expect(f.executor(n.transport).executeNext(p.id,actor,0)).rejects.toThrow();expect(n.fetch).not.toHaveBeenCalled();if(phase==='acquire')expect(n.credential).not.toHaveBeenCalled();else expect(n.credential).toHaveBeenCalledOnce();expect(f.parents().get(p.id)).toMatchObject({status:'unknown',attemptCount:1});
});

it.each(['acquire','send'] as const)('postcommit settings %s expiry preserves the original reservation and never replays',async phase=>{
 const f=fixture(),p=await f.executable(),n=f.native();let arm=false,q=0,c=0;const transaction=f.repo.transaction.bind(f.repo);
 f.repo.transaction=async fn=>{const result=await transaction(fn);if(arm)f.clock.mockResolvedValue({earliest:at+60000,latest:at+60001});return result};
 n.qualified.mockImplementation(async()=>{if(phase==='acquire'&&++q===2)arm=true});n.credentialCurrent.mockImplementation(async()=>{if(phase==='send'&&++c===2)arm=true});
 await expect(f.executor(n.transport).executeNext(p.id,actor,0)).rejects.toThrow();expect(arm).toBe(true);expect(n.fetch).not.toHaveBeenCalled();if(phase==='acquire')expect(n.credential).not.toHaveBeenCalled();else expect(n.credential).toHaveBeenCalledOnce();expect(f.parents().get(p.id)).toMatchObject({status:'unknown',attemptCount:1});
 await expect(f.executor(n.transport).executeNext(p.id,actor,0)).rejects.toThrow();expect(n.fetch).not.toHaveBeenCalled();if(phase==='acquire')expect(n.credential).not.toHaveBeenCalled();else expect(n.credential).toHaveBeenCalledOnce();
});

it.each(['acquire','send'] as const)('postcommit settings %s native refusal is outside authorization and retains unknown history',async phase=>{
 const f=fixture(),p=await f.executable(),n=f.native();n.dispatchCurrent.mockImplementation(async(...args:unknown[])=>{expect(f.depth()).toBe(0);if(args[1]===(phase==='acquire'?'settings.credential.copy':'settings.request.create'))throw Error('sealed native generation revoked')});
 await expect(f.executor(n.transport).executeNext(p.id,actor,0)).rejects.toThrow();expect(n.fetch).not.toHaveBeenCalled();if(phase==='acquire')expect(n.credential).not.toHaveBeenCalled();else expect(n.credential).toHaveBeenCalledOnce();expect(f.parents().get(p.id)).toMatchObject({status:'unknown',attemptCount:1});await expect(f.executor(n.transport).executeNext(p.id,actor,0)).rejects.toThrow();expect(n.fetch).not.toHaveBeenCalled();
});
