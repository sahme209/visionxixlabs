/** @vitest-environment jsdom */
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const io=vi.hoisted(()=>({refresh:vi.fn(),fetch:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:io.refresh})}));
import {Catalog,type CatalogEntry} from '../Catalog';
const entries:CatalogEntry[]=[{id:'integration-audit',name:'Integration audit',description:'Review connected providers',kind:'Skills',status:'not_installed',permissions:['list_integrations']}];
beforeEach(()=>{vi.resetAllMocks();vi.stubGlobal('fetch',io.fetch);io.fetch.mockResolvedValue(new Response(JSON.stringify({ok:true,data:{skillId:'integration-audit',status:'enabled'}}),{status:200}));});
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('confirms installation, calls the workspace service and refreshes recorded state',async()=>{
 render(createElement(Catalog,{entries,unavailable:false,canManage:true}));fireEvent.click(screen.getByRole('button',{name:'Skills'}));
 fireEvent.click(screen.getByRole('button',{name:'Install Integration audit'}));expect(io.fetch).not.toHaveBeenCalled();
 expect(screen.getByRole('dialog',{name:'Install Integration audit?'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Install skill'}));
 await waitFor(()=>expect(io.refresh).toHaveBeenCalledOnce());
 expect(io.fetch).toHaveBeenCalledWith('/api/control/skills',expect.objectContaining({method:'POST',credentials:'include',body:JSON.stringify({skillId:'integration-audit',action:'install'})}));
});
it('does not mutate when installation is canceled',()=>{
 render(createElement(Catalog,{entries,unavailable:false,canManage:true}));fireEvent.click(screen.getByRole('button',{name:'Skills'}));fireEvent.click(screen.getByRole('button',{name:'Install Integration audit'}));fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(io.fetch).not.toHaveBeenCalled();
});
it.each([{canManage:false,unavailable:false},{canManage:true,unavailable:true}])('hides changes without authority or storage: %j',props=>{
 render(createElement(Catalog,{entries,...props}));fireEvent.click(screen.getByRole('button',{name:'Skills'}));expect(screen.queryByRole('button',{name:'Install Integration audit'})).toBeNull();
});
it('treats a failed response as unconfirmed rather than installed',async()=>{
 io.fetch.mockRejectedValue(Error('network'));render(createElement(Catalog,{entries,unavailable:false,canManage:true}));fireEvent.click(screen.getByRole('button',{name:'Skills'}));fireEvent.click(screen.getByRole('button',{name:'Install Integration audit'}));fireEvent.click(screen.getByRole('button',{name:'Install skill'}));await screen.findByRole('alert');expect(screen.getByRole('alert').textContent).toContain('not confirmed');expect(screen.getByText('not installed')).toBeTruthy();
});
