/** @vitest-environment jsdom */
import { createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AIGovernancePanel } from '../AIGovernancePanel';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const fixture={canManage:true,providerPolicy:{enabled:false,allowedProviders:[],modelSelections:{},fallbackOrder:[]},availableProviders:[],gatewayModels:null,gatewayCatalogLive:false,agentIdentityState:'ready',agentIdentity:{displayName:'Local Agent',enabled:false,allowedTools:['list_environments'],updatedAt:'2026-10-22'},autonomy:{mode:'observer',perCycleActionLimit:1,rationale:''},budget:{defaultMaxCostCents:100},tools:[{name:'list_environments',description:'Read workspace environments.',riskLevel:'low'},{name:'trigger_aws_deploy',description:'Restart only the reviewed target.',riskLevel:'high'}]};
function show(canManage=true){const fetcher=vi.fn(async(_url:string,options?:RequestInit)=>Response.json(options?.method==='PATCH'?{ok:true}:{ok:true,data:{...fixture,canManage}}));vi.stubGlobal('fetch',fetcher);render(createElement(AIGovernancePanel));return fetcher;}
it('keeps configuration focused and preserves identity/tool drafts when switching views',async()=>{
 const fetcher=show();await screen.findByRole('tab',{name:'Configuration'});
 expect(screen.getByRole('tabpanel',{name:'Configuration'})).toBeTruthy();
 expect(screen.queryByRole('checkbox',{name:'list environments low'})).toBeNull();
 fireEvent.change(screen.getByRole('textbox',{name:'Identity name'}),{target:{value:'Draft Agent'}});
 fireEvent.click(screen.getByRole('tab',{name:'Tool permissions'}));
 fireEvent.click(screen.getByText('High-risk tools',{exact:true}));
 fireEvent.click(screen.getByRole('checkbox',{name:'trigger aws deploy high'}));
 fireEvent.click(screen.getByRole('tab',{name:'Agent profiles'}));
 expect(screen.getByRole('region',{name:'Effective specialized Agent permissions'}).textContent).toContain('0 tools in saved policy');
 fireEvent.click(screen.getByRole('tab',{name:'Configuration'}));
 expect((screen.getByRole('textbox',{name:'Identity name'}) as HTMLInputElement).value).toBe('Draft Agent');
 fireEvent.click(screen.getByRole('button',{name:'Save identity'}));
 await screen.findByText('Agent identity saved and reloaded.');
 const request=fetcher.mock.calls.find(([,options])=>options?.method==='PATCH')!;
 expect(JSON.parse(String(request[1]?.body))).toEqual({section:'agent_identity',displayName:'Draft Agent',enabled:false,allowedTools:['list_environments','trigger_aws_deploy']});
});
it('supports keyboard navigation between focused views',async()=>{
 show();const tab=await screen.findByRole('tab',{name:'Configuration'});tab.focus();fireEvent.keyDown(tab,{key:'ArrowRight'});
 expect(screen.getByRole('tab',{name:'Tool permissions'})).toBe(document.activeElement);
 expect(screen.getByRole('tabpanel',{name:'Tool permissions'})).toBeTruthy();
 fireEvent.keyDown(document.activeElement!,{key:'End'});
 expect(screen.getByRole('tabpanel',{name:'Agent profiles'})).toBeTruthy();
});
it('lets read-only members inspect permissions without gaining save authority',async()=>{
 const fetcher=show(false);fireEvent.click(await screen.findByRole('tab',{name:'Tool permissions'}));
 fireEvent.click(screen.getByText('Read tools',{exact:true}));
 expect((screen.getByRole('checkbox',{name:'list environments low'}) as HTMLInputElement).disabled).toBe(true);
 expect((screen.getByRole('button',{name:'Save identity'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Save identity'}));
 await waitFor(()=>expect(fetcher).toHaveBeenCalledOnce());
});

it.each(['', '0', '-1', '1.001', '1000001'])('rejects invalid spending limit %j without a request', async(value)=>{
 const fetcher=show();await screen.findByRole('tab',{name:'Configuration'});
 fireEvent.change(screen.getByRole('spinbutton',{name:'Maximum cost per run (USD)'}),{target:{value}});
 fireEvent.click(screen.getByRole('button',{name:'Save spending limit'}));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Enter a spending limit from $0.01 to $1,000,000, in whole cents.');
 expect(fetcher.mock.calls.some(([,options])=>options?.method==='PATCH')).toBe(false);
});

it('shows an explicitly uncapped saved policy honestly and requires a positive cap before saving',async()=>{
 const fetcher=vi.fn(async()=>Response.json({ok:true,data:{...fixture,budget:{defaultMaxCostCents:null}}}));
 vi.stubGlobal('fetch',fetcher);render(createElement(AIGovernancePanel));
 const field=await screen.findByRole('spinbutton',{name:'Maximum cost per run (USD)'});
 expect((field as HTMLInputElement).value).toBe('');
 expect(field.getAttribute('placeholder')).toBe('No workspace cap configured');
 fireEvent.click(screen.getByRole('button',{name:'Save spending limit'}));
 expect(await screen.findByRole('alert')).toBeTruthy();expect(fetcher).toHaveBeenCalledOnce();
});
