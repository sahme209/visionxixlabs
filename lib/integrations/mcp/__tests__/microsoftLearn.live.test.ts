import {expect,it} from 'vitest';
import {checkMicrosoftLearn,searchInstalledMicrosoftLearn} from '../microsoftLearn';
it.skipIf(process.env.AXIOM_MICROSOFT_LEARN_ACCEPTANCE!=='public-docs-read-only')('uses the official Microsoft server for a real bounded documentation search',async()=>{
 expect(await checkMicrosoftLearn()).toEqual({ok:true,data:{searchAvailable:true}});
 const repo={agentSkillInstallation:{findMany:async()=>[{skillId:'microsoft-learn-docs',status:'enabled'}]}};
 const result=await searchInstalledMicrosoftLearn(repo,'local-public-docs-acceptance','Azure App Service managed identity');
 expect(result.ok).toBe(true);if(result.ok){expect(result.data.results.length).toBeGreaterThan(0);expect(result.data.results.length).toBeLessThanOrEqual(10);for(const row of result.data.results){expect(new URL(row.url).origin).toBe('https://learn.microsoft.com');expect(row.excerpt.length).toBeLessThanOrEqual(1200);}}
},55000);
