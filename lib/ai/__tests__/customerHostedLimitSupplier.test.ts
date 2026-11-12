import {it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {readAcceptedCustomerHostedLimits,customerHostedAcceptancePath} from '../customerHostedLimitSupplier';
const config={digest:'a'.repeat(64),models:[{id:'local',maxInputTokens:100,maxOutputTokens:20}]};
const now=Date.parse('2026-11-11T12:00:00.000Z');
function fixture(){
 const evidence={format:'axiom.isolated-model-limits/1',configDigest:config.digest,modelId:'local',maxInputTokens:100,maxOutputTokens:20,inputLimitEnforced:true,outputLimitEnforced:true,usageVerified:true,observedAt:'2026-11-11T11:00:00.000Z'};
 const bytes=Buffer.from(JSON.stringify(evidence)),digest=createHash('sha256').update(bytes).digest('hex');
 const record={format:'axiom.operator-model-limits/1',configDigest:config.digest,modelId:'local',maxInputTokens:100,maxOutputTokens:20,expiresAt:'2026-11-12T00:00:00.000Z',evidenceSha256:digest,operatorReviewedAt:'2026-11-11T11:30:00.000Z'};
 const read=vi.fn(async(path:string)=>path===customerHostedAcceptancePath(config.digest,'local')?Buffer.from(JSON.stringify(record)):bytes);
 return {record,evidence,read,bytes};
}
it('binds protected operator review to the exact evidence bytes and full token limits',async()=>{
 const f=fixture();expect(await readAcceptedCustomerHostedLimits(config,'local',now,f.read)).toMatchObject({reservedTokens:120,expiresAt:Date.parse(f.record.expiresAt),evidenceSha256:f.record.evidenceSha256});expect(f.read).toHaveBeenCalledTimes(2);
});
it('refuses missing/untrusted files, altered evidence and stale acceptance',async()=>{
 const missing=fixture();missing.read.mockRejectedValue(Error('untrusted file'));expect(await readAcceptedCustomerHostedLimits(config,'local',now,missing.read)).toBeNull();
 const changed=fixture();changed.read.mockResolvedValueOnce(Buffer.from(JSON.stringify(changed.record))).mockResolvedValueOnce(Buffer.from(JSON.stringify({...changed.evidence,usageVerified:false})));expect(await readAcceptedCustomerHostedLimits(config,'local',now,changed.read)).toBeNull();
 const expired=fixture();expired.record.expiresAt='2026-11-11T12:00:00.000Z';expect(await readAcceptedCustomerHostedLimits(config,'local',now,expired.read)).toBeNull();
});
it('requires prior actual observation, later operator review and all three acceptance checks',async()=>{
 for(const delta of [{inputLimitEnforced:false},{outputLimitEnforced:false},{usageVerified:false},{modelId:'other'},{observedAt:'2026-11-11T13:00:00.000Z'}]){
  const f=fixture(),bytes=Buffer.from(JSON.stringify({...f.evidence,...delta}));f.record.evidenceSha256=createHash('sha256').update(bytes).digest('hex');f.read.mockImplementation(async path=>path===customerHostedAcceptancePath(config.digest,'local')?Buffer.from(JSON.stringify(f.record)):bytes);expect(await readAcceptedCustomerHostedLimits(config,'local',now,f.read)).toBeNull();
 }
});
it('accepts only a single ACL-free metadata line, never an ACL grant or extra output',async()=>{
 const {customerHostedNoAclListing}=await import('../customerHostedLimitSupplier');
 expect(customerHostedNoAclListing('-rw-r--r--  1 root wheel 1 Nov 11 acceptance.json\n')).toBe(true);
 expect(customerHostedNoAclListing('drwxr-xr-x@  2 root wheel 1 Nov 11 directory\n')).toBe(true);
 for(const text of ['-rw-r--r--+ 1 root wheel 1 Nov 11 file\n 0: user:any allow write\n','-rw-r--r-- 1 root wheel 1 Nov 11 file\nextra','not metadata',''])expect(customerHostedNoAclListing(text)).toBe(false);
});
it('rejects non-root, writable, symlink and wrong-kind resource metadata',async()=>{
 const {customerHostedProtectedStat}=await import('../customerHostedLimitSupplier');
 const file={uid:0,mode:0o644,isSymbolicLink:()=>false,isFile:()=>true,isDirectory:()=>false};
 expect(customerHostedProtectedStat(file,true)).toBe(true);
 for(const change of [{uid:501},{mode:0o664},{mode:0o646},{isSymbolicLink:()=>true},{isFile:()=>false}])expect(customerHostedProtectedStat({...file,...change},true)).toBe(false);
 expect(customerHostedProtectedStat(file,false)).toBe(false);
});
