import {expect,it} from 'vitest';
import {releaseOperationPlanId} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {parseReleaseOperationPlanInput,parseReleaseOperationPlanDto} from '../releaseOperationPlanContract';
it('rejects fabricated execution grants and mutable operation fields',()=>{expect(()=>parseReleaseOperationPlanInput({format:1,approved:true})).toThrow();expect(()=>parseReleaseOperationPlanDto({executionAvailable:true})).toThrow()});
it('binds deterministic plan identity to tenant, request version and digest',()=>{const a=releaseOperationPlanId('org','release',1,'a'.repeat(64));expect(a).toMatch(/^release_plan_[a-f0-9]{64}$/);expect(a).toBe(releaseOperationPlanId('org','release',1,'a'.repeat(64)));expect(a).not.toBe(releaseOperationPlanId('other','release',1,'a'.repeat(64)))});
