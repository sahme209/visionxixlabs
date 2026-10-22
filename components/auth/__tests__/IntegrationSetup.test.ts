/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {IntegrationConnectionAction} from '../IntegrationConnectionAction';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it.each(['github','slack','teams','linear'] as const)('explains missing %s setup without starting authorization',async(provider)=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 render(createElement(IntegrationConnectionAction,{provider,label:provider,connected:false,setupAvailable:false}));
 const button=screen.getByRole('button',{name:'View setup'});fireEvent.click(button);
 expect(button.getAttribute('aria-expanded')).toBe('true');
 expect(screen.getByRole('status').textContent).toContain('registered callback');
 expect(fetcher).not.toHaveBeenCalled();fireEvent.click(button);
 expect(screen.queryByRole('status')).toBeNull();
});
it.each(['github','slack','teams','linear'] as const)('rejects untrusted %s authorization destinations',async(provider)=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({ok:true,data:{installUrl:'https://attacker.invalid/authorize',consentUrl:'https://attacker.invalid/authorize'}}));vi.stubGlobal('fetch',fetcher);
 render(createElement(IntegrationConnectionAction,{provider,label:provider,connected:false,setupAvailable:true}));
 fireEvent.click(screen.getByRole('button',{name:'Connect ↗'}));
 expect((await screen.findByRole('status')).textContent).toContain('connection is unavailable');
 expect(fetcher).toHaveBeenCalledWith(provider==='github'?'/api/dashboard/github-installation-start':`/api/account/integrations/${provider}/start`,{method:'POST',credentials:'include'});
});
