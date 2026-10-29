import {expect,it,vi} from 'vitest';
import {readUsageRecords,usageCsv} from '../usageRecords';
const now=new Date('2026-10-22T12:00:00Z');
it('scopes the bounded ledger read and filters to the authenticated organization',async()=>{
 const findMany=vi.fn().mockResolvedValue([{id:'one',provider:'gateway',model:'model',billingStatus:'pending',inputTokens:7,outputTokens:2,billedCents:999,createdAt:now}]);
 const page=await readUsageRecords({usageEvent:{findMany}},'org-current',new URLSearchParams('month=2026-09&status=pending&offset=50&organizationId=other'),now);
 expect(findMany).toHaveBeenCalledWith(expect.objectContaining({where:{organizationId:'org-current',eventKind:'ai_invocation',createdAt:{gte:new Date('2026-09-01Z'),lt:new Date('2026-10-01Z')},billingStatus:'pending'},skip:50,take:51}));
 expect(page.rows[0].settledCents).toBeNull();expect(page.offset).toBe(50);
 expect(findMany.mock.calls[0][0].select).not.toHaveProperty('metadata');
});
it.each(['month=2026-13','month=2024-01','month=2026-11','status=anything','offset=-1','offset=2','offset=10050'])('rejects invalid or unbounded selection %s',async query=>{
 const findMany=vi.fn();await expect(readUsageRecords({usageEvent:{findMany}},'org',new URLSearchParams(query),now)).rejects.toThrow('usage_filter_invalid');expect(findMany).not.toHaveBeenCalled();
});
it('uses an extra record only to establish pagination',async()=>{
 const findMany=vi.fn().mockResolvedValue(Array.from({length:51},(_,i)=>({id:String(i),createdAt:now,provider:null,model:null,inputTokens:1,outputTokens:2,billedCents:3,billingStatus:'settled'})));
 const page=await readUsageRecords({usageEvent:{findMany}},'org',new URLSearchParams(),now);expect(page.rows).toHaveLength(50);expect(page.hasMore).toBe(true);expect(page.rows[0].settledCents).toBe(3);
});
it('escapes spreadsheet formulas and CSV separators without exporting private fields',()=>{
 const csv=usageCsv({month:'2026-10',offset:0,hasMore:false,rows:[{id:'one',createdAt:now.toISOString(),provider:'=HYPERLINK("secret")',model:'a,b',status:'pending',inputTokens:1,outputTokens:2,settledCents:null}]});
 expect(csv).toContain('"\'=HYPERLINK(""secret"")"');expect(csv).toContain('"a,b"');expect(csv).toContain('pending');expect(csv).not.toContain('organizationId');
});
