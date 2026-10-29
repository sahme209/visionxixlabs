/** @vitest-environment jsdom */
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MicrosoftLearnTools} from '../MicrosoftLearnTools';
const io=vi.hoisted(()=>({fetch:vi.fn()}));
beforeEach(()=>{vi.resetAllMocks();vi.stubGlobal('fetch',io.fetch);});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('does not search without installation or unavailable state and offers the actual management route',()=>{
 render(createElement(MicrosoftLearnTools,{enabled:false,storageAvailable:true}));
 expect((screen.getByRole('button',{name:'Search docs'}) as HTMLButtonElement).disabled).toBe(true);
 expect(screen.getByRole('link',{name:'Manage MCP'}).getAttribute('href')).toBe('/control/plugins?tab=mcp');expect(io.fetch).not.toHaveBeenCalled();
});
it('checks capability without changing installation state',async()=>{
 io.fetch.mockResolvedValue(new Response(JSON.stringify({ok:true,data:{searchAvailable:true}})));
 render(createElement(MicrosoftLearnTools,{enabled:false,storageAvailable:true}));fireEvent.click(screen.getByRole('button',{name:'Check connection'}));
 expect((await screen.findByRole('status')).textContent).toContain('does not install');
 expect((screen.getByRole('button',{name:'Search docs'}) as HTMLButtonElement).disabled).toBe(true);
});
it('renders only source links from verified Microsoft results and prevents duplicate requests',async()=>{
 let resolve!:(value:Response)=>void;io.fetch.mockReturnValue(new Promise<Response>(done=>{resolve=done;}));
 render(createElement(MicrosoftLearnTools,{enabled:true,storageAvailable:true}));
 fireEvent.change(screen.getByLabelText('Search Microsoft documentation'),{target:{value:'Azure identity'}});fireEvent.click(screen.getByRole('button',{name:'Search docs'}));
 expect((screen.getByRole('button',{name:'Searching…'}) as HTMLButtonElement).disabled).toBe(true);
 resolve(new Response(JSON.stringify({ok:true,data:{results:[{title:'Managed identity',excerpt:'<script>untrusted text</script>',url:'https://learn.microsoft.com/en-us/azure/identity'},{title:'Unsafe',excerpt:'bad',url:'javascript:alert(1)'}]}})));
 const link=await screen.findByRole('link',{name:'Managed identity'});expect(link.getAttribute('href')).toBe('https://learn.microsoft.com/en-us/azure/identity');expect(screen.queryByRole('link',{name:'Unsafe'})).toBeNull();
 expect(screen.getByText('<script>untrusted text</script>')).toBeTruthy();expect(io.fetch).toHaveBeenCalledOnce();
});
it('clears stale results and explains revocation without leaking diagnostics',async()=>{
 io.fetch.mockResolvedValue(new Response(JSON.stringify({ok:false,error:'mcp_not_enabled'}),{status:409}));render(createElement(MicrosoftLearnTools,{enabled:true,storageAvailable:true}));fireEvent.change(screen.getByLabelText('Search Microsoft documentation'),{target:{value:'Azure identity'}});fireEvent.click(screen.getByRole('button',{name:'Search docs'}));await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Enable Microsoft Learn'));
});
