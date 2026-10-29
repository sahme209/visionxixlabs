import { describe, expect, it, vi } from "vitest";
import { loadWorkspaceMemory, rememberToolContext, workspaceMemoryPrompt, normalizeWorkspaceMemory, type WorkspaceMemoryRepo } from "../workspaceMemory";

describe("Agent workspace memory", () => {
  it("fails open with empty context while the migration is unavailable", async () => {
    const repo = { agentWorkspaceMemory: { findUnique: vi.fn().mockRejectedValue(new Error("missing")) } } as unknown as WorkspaceMemoryRepo;
    await expect(loadWorkspaceMemory(repo, "org-1")).resolves.toEqual({ repositoryFullNames: [], environmentIds: [] });
  });

  it("remembers real tool identifiers and places the newest first", async () => {
    const upsert = vi.fn().mockResolvedValue({ repositoryFullNames: ["acme/widgets"], environmentIds: ["env_prod"] });
    const repo = {
      agentWorkspaceMemory: {
        findUnique: vi.fn().mockResolvedValue({ repositoryFullNames: ["acme/api"], environmentIds: [] }),
        upsert,
      },
    } as unknown as WorkspaceMemoryRepo;
    await rememberToolContext(repo, "org-1", { repositoryFullName: "acme/widgets", environmentId: "env_prod" });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { repositoryFullNames: ["acme/widgets", "acme/api"], environmentIds: ["env_prod"] },
    }));
  });

  it("renders concise context for the decision loop", () => {
    expect(workspaceMemoryPrompt({ repositoryFullNames: ["acme/widgets"], environmentIds: ["env_stage"] }))
      .toContain("acme/widgets");
  });
});

describe('workspace memory normalization and byte limits',()=>{
 const stored=(value:unknown)=>({agentWorkspaceMemory:{findUnique:vi.fn().mockResolvedValue(value),upsert:vi.fn().mockResolvedValue(value)}}) as unknown as WorkspaceMemoryRepo;
 it('normalizes malformed legacy rows on read without crossing the requested tenant',async()=>{const repo=stored({repositoryFullNames:['acme/api',null,'acme/api','bad/repo/extra',123,'x'.repeat(50000)+'/repo','acme/widgets'],environmentIds:[' env_stage ','env_stage',false,'\nmalformed','y'.repeat(50000),'prod']});expect(await loadWorkspaceMemory(repo,'org-owned')).toEqual({repositoryFullNames:['acme/api','acme/widgets'],environmentIds:['env_stage','prod']});expect(repo.agentWorkspaceMemory.findUnique).toHaveBeenCalledWith({where:{organizationId:'org-owned'}})});
 it('treats unexpected category types as empty while preserving valid other values',async()=>{expect(await loadWorkspaceMemory(stored({repositoryFullNames:'acme/api',environmentIds:['env_owned']}),'org')).toEqual({repositoryFullNames:[],environmentIds:['env_owned']});expect(await loadWorkspaceMemory(stored(null),'org')).toEqual({repositoryFullNames:[],environmentIds:[]})});
 it('deduplicates and caps both categories when rendering unchecked legacy values directly',()=>{const prompt=workspaceMemoryPrompt({repositoryFullNames:Array.from({length:25},(_,i)=>`acme/repo${i}`).concat('acme/repo0'),environmentIds:Array.from({length:25},(_,i)=>`env_${i}`).concat('env_0')});expect(prompt).toContain('acme/repo19');expect(prompt).not.toContain('acme/repo20');expect(prompt).not.toContain('env_20');expect(prompt.split('acme/repo0').length-1).toBe(1)});
 it('enforces per-identifier UTF-8 limits rather than character counts',async()=>{const valid='界'.repeat(85),oversize='界'.repeat(86);expect(await loadWorkspaceMemory(stored({repositoryFullNames:[],environmentIds:[oversize,valid,'\ud800']}),'org')).toEqual({repositoryFullNames:[],environmentIds:[valid]})});
 it('keeps the complete rendered prompt within 8KiB UTF-8 even for two full valid categories',async()=>{const value={repositoryFullNames:Array.from({length:20},(_,i)=>`${'o'.repeat(99)}${i%10}/${'r'.repeat(98)}${i}`),environmentIds:Array.from({length:20},(_,i)=>`${'界'.repeat(84)}${i}`)};const memory=await loadWorkspaceMemory(stored(value),'org');expect(Buffer.byteLength(workspaceMemoryPrompt(value),'utf8')).toBeLessThanOrEqual(8192);expect(Buffer.byteLength(workspaceMemoryPrompt(memory),'utf8')).toBeLessThanOrEqual(8192);expect(memory.repositoryFullNames.length).toBeGreaterThan(0);expect(memory.environmentIds.length).toBeGreaterThan(0)});
 it('normalizes every category on writes, including the category the tool did not update',async()=>{const repo=stored({repositoryFullNames:Array.from({length:30},(_,i)=>`acme/repo${i}`),environmentIds:['old','old',null,'界'.repeat(100)]});await rememberToolContext(repo,'org-owned',{environmentId:' new_env '});expect(repo.agentWorkspaceMemory.upsert).toHaveBeenCalledWith({where:{organizationId:'org-owned'},create:{organizationId:'org-owned',repositoryFullNames:Array.from({length:20},(_,i)=>`acme/repo${i}`),environmentIds:['new_env','old']},update:{repositoryFullNames:Array.from({length:20},(_,i)=>`acme/repo${i}`),environmentIds:['new_env','old']}})});
 it('rejects oversized tool identifiers without persisting them',async()=>{const repo=stored({repositoryFullNames:['acme/api'],environmentIds:['env_owned']});await rememberToolContext(repo,'org',{repositoryFullName:'x'.repeat(50000)+'/repo',environmentId:'界'.repeat(100)});expect(repo.agentWorkspaceMemory.upsert).not.toHaveBeenCalled()});
});

it('preserves valid legacy identifiers and normalizes repository identity without losing its display case',()=>{expect(normalizeWorkspaceMemory({repositoryFullNames:['Acme/Widgets','acme/widgets','acme/API'],environmentIds:['env_A','env_a','env_A']})).toEqual({repositoryFullNames:['Acme/Widgets','acme/API'],environmentIds:['env_A','env_a']})});
it('bounds legacy scanning as well as rendered output',()=>{let reads=0;const values=new Proxy(Array.from({length:10000},()=>null),{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))reads++;return Reflect.get(target,key,receiver)}});expect(normalizeWorkspaceMemory({repositoryFullNames:values,environmentIds:[]})).toEqual({repositoryFullNames:[],environmentIds:[]});expect(reads).toBeLessThanOrEqual(100)});
it('writes the same complete UTF-8 bounded form that prompt rendering consumes',async()=>{const row={repositoryFullNames:Array.from({length:20},(_,i)=>`${'o'.repeat(99)}${i%10}/${'r'.repeat(98)}${i}`),environmentIds:Array.from({length:20},(_,i)=>`${'界'.repeat(84)}${i}`)};const upsert=vi.fn().mockResolvedValue(row);const repo={agentWorkspaceMemory:{findUnique:vi.fn().mockResolvedValue(row),upsert}} as WorkspaceMemoryRepo;await rememberToolContext(repo,'org-owned',{repositoryFullName:'acme/latest',environmentId:'env_latest'});const written=upsert.mock.calls[0][0];expect(written.create.organizationId).toBe('org-owned');expect(written.update.repositoryFullNames[0]).toBe('acme/latest');expect(written.update.environmentIds[0]).toBe('env_latest');expect(written.update).toEqual(normalizeWorkspaceMemory(written.update));expect(Buffer.byteLength(workspaceMemoryPrompt(written.update),'utf8')).toBeLessThanOrEqual(8192)});
