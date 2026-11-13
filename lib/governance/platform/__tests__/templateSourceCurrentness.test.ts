import {it,expect,vi,beforeEach} from 'vitest';
import {createHash} from 'node:crypto';
const fixture=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('node:fs/promises',()=>({readFile:fixture.read}));
import {createCurrentPlatformAuthority} from '../currentAuthority';
import {templateObjectEffect,templateAccessEffect} from '@/lib/cloud/aws/platformTemplatePlan';
import type {PlatformTransaction} from '../actionStore';
const bytes=Buffer.from('Resources: {}\n');
const digest=createHash('sha256').update(bytes).digest('hex');
const tx={} as PlatformTransaction;
const authority=createCurrentPlatformAuthority(()=>['admin@example.test']);
const object=()=>templateObjectEffect('123456789012','us-east-2',digest);
const access=()=>templateAccessEffect({accountId:'123456789012',region:'us-east-2',bytesDigest:digest,objectVersion:'version-1',recipientDigest:'b'.repeat(64),ttlSeconds:60});
beforeEach(()=>{fixture.read.mockReset();fixture.read.mockResolvedValue(bytes)});
it('checks the fixed current template bytes for upload and access review',async()=>{
 for(const effect of [object(),access()])await expect(authority.assertEffectCurrent!(tx,effect)).resolves.toBeUndefined();
 expect(fixture.read).toHaveBeenCalledTimes(2);
 expect(fixture.read.mock.calls.every(call=>String(call[0]).endsWith('/public/aws/axiom-agent-quick-deploy.yaml'))).toBe(true);
});
it('refuses changed, missing, empty or oversized template source before approving an effect',async()=>{
 for(const effect of [object(),access()]){
  for(const value of [Buffer.from('Resources: changed\n'),Buffer.alloc(0),Buffer.alloc(256*1024+1)]){
   fixture.read.mockResolvedValue(value);await expect(authority.assertEffectCurrent!(tx,effect)).rejects.toThrow();
  }
  fixture.read.mockRejectedValue(Error('unavailable'));await expect(authority.assertEffectCurrent!(tx,effect)).rejects.toThrow();
 }
});
it('requires canonical us-east-2 bucket creation targets without reading template content',async()=>{
 const good={id:'bucket',kind:'template.bucket.create' as const,target:{accountId:'123456789012',region:'us-east-2',bucket:'axiom-cfn-templates-123456789012'}};
 await expect(authority.assertEffectCurrent!(tx,good)).resolves.toBeUndefined();
 for(const target of [{...good.target,region:'us-east-1'},{...good.target,bucket:'other-bucket'}])await expect(authority.assertEffectCurrent!(tx,{...good,target})).rejects.toThrow();
 expect(fixture.read).not.toHaveBeenCalled();
});
