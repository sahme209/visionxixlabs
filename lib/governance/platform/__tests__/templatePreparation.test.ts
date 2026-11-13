import {it,expect,vi,beforeEach} from 'vitest';
import {createHash} from 'node:crypto';
const source=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('@/lib/cloud/aws/platformTemplateSource',()=>({readPlatformTemplateBytes:source.read}));
import {prepareTemplatePlatformPlan,matchesTemplateSelection} from '../templatePreparation';
const now=Date.parse('2026-11-12T00:00:00Z'),base={accountId:'123456789012',region:'us-east-2',expiresAt:new Date(now+60000).toISOString()};
beforeEach(()=>{source.read.mockReset();source.read.mockResolvedValue(Buffer.from('Resources: {}\n'))});
it('derives content-addressed upload and version-pinned access effects from the fixed server template',async()=>{
 const upload=await prepareTemplatePlatformPlan({...base,operation:'upload'},now),hash=createHash('sha256').update('Resources: {}\n').digest('hex');
 expect(upload.effects[0]).toMatchObject({kind:'template.object.put',target:{bucket:'axiom-cfn-templates-123456789012',key:'templates/axiom-agent-quick-deploy-'+hash+'.yaml',bytesDigest:hash}});
 const access=await prepareTemplatePlatformPlan({...base,operation:'access',objectVersion:'version-1',recipientDigest:'b'.repeat(64),ttlSeconds:60},now);
 expect(access.effects[0]).toMatchObject({kind:'template.access.grant',target:{bytesDigest:hash,objectVersion:'version-1',ttlSeconds:60}});expect(access.digest).not.toBe(upload.digest);expect(source.read).toHaveBeenCalledTimes(2);
});
it('separates bucket creation and rejects unsafe region, caller content, invalid clocks and expired selections',async()=>{
 const selection={...base,operation:'create_bucket'},plan=await prepareTemplatePlatformPlan(selection,now);expect(plan.effects[0].kind).toBe('template.bucket.create');expect(source.read).not.toHaveBeenCalled();
 for(const selected of [{...selection,region:'us-east-1'},{...base,operation:'upload',yaml:'injected'},{...base,operation:'access',objectVersion:'null',recipientDigest:'b'.repeat(64),ttlSeconds:60},{...base,operation:'upload',expiresAt:new Date(now).toISOString()}])await expect(prepareTemplatePlatformPlan(selected,now)).rejects.toThrow();
 await expect(prepareTemplatePlatformPlan({...base,operation:'upload'},NaN)).rejects.toThrow();
});
it('matches original selection without reloading or renewing source under a reused reference',async()=>{
 const selection={...base,operation:'upload'},plan=await prepareTemplatePlatformPlan(selection,now);source.read.mockRejectedValue(Error('changed or missing source'));
 expect(matchesTemplateSelection(plan,selection)).toBe(true);expect(matchesTemplateSelection(plan,{...selection,accountId:'999999999999'})).toBe(false);expect(matchesTemplateSelection(plan,{...selection,expiresAt:new Date(now+120000).toISOString()})).toBe(false);expect(source.read).toHaveBeenCalledTimes(1);
});
