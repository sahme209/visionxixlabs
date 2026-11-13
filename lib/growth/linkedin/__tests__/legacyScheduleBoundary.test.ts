import {it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({read:vi.fn(),update:vi.fn()}));
vi.mock('@/lib/db',()=>({prisma:{linkedInPostDraft:{findUnique:m.read,update:m.update}}}));
vi.mock('../../audit',()=>({writeGrowthAudit:vi.fn()}));
import {transitionStatus} from '../../draftStore';
it('legacy status calls cannot schedule work or assert provider publication',async()=>{
 for(const to of ['scheduled','published'] as const)expect(await transitionStatus('draft',to,'caller-email',{scheduledFor:new Date(),linkedinPostUrn:'urn:li:share:unverified'})).toEqual({kind:'governance_required'});
 expect(m.read).not.toHaveBeenCalled();expect(m.update).not.toHaveBeenCalled();
});
