/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {IntegrationConnectionAction} from '../IntegrationConnectionAction';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it.each(['github','slack','teams','linear'] as const)('starts the real %s authorization endpoint and handles unavailable service configuration',async(provider)=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({ok:false,error:'provider_not_configured'},{status:503}));vi.stubGlobal('fetch',fetcher);
 render(createElement(IntegrationConnectionAction,{provider,label:provider,connected:false}));
 fireEvent.click(screen.getByRole('button',{name:'Connect ↗'}));
 expect((await screen.findByRole('status')).textContent).toContain('connection is unavailable');
 expect(fetcher).toHaveBeenCalledOnce();
 expect(screen.queryByText('View setup')).toBeNull();
});
it.each(['github','slack','teams','linear'] as const)('rejects untrusted %s authorization destinations',async(provider)=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({ok:true,data:{installUrl:'https://attacker.invalid/authorize',consentUrl:'https://attacker.invalid/authorize'}}));vi.stubGlobal('fetch',fetcher);
 render(createElement(IntegrationConnectionAction,{provider,label:provider,connected:false}));
 fireEvent.click(screen.getByRole('button',{name:'Connect ↗'}));
 expect((await screen.findByRole('status')).textContent).toContain('connection is unavailable');
 expect(fetcher).toHaveBeenCalledWith(provider==='github'?'/api/dashboard/github-installation-start':`/api/account/integrations/${provider}/start`,{method:'POST',credentials:'include'});
});
