/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {ServiceNowJournalConsentAction} from '../ServiceNowJournalConsentAction';
const fetcher=vi.fn(),revision='2026-10-30T11:00:00.000Z';
beforeEach(()=>{vi.stubGlobal('fetch',fetcher);fetcher.mockReset()});afterEach(()=>{cleanup();vi.unstubAllGlobals()});
function mount(){const view=render(createElement(ServiceNowJournalConsentAction,{revision}));fireEvent.change(screen.getByLabelText('Installed API namespace'),{target:{value:'2278454'}});fireEvent.click(screen.getByRole('checkbox'));return view}
it('sends only the explicit saved revision and namespace once, and does not retry an unknown outcome',async()=>{
 fetcher.mockResolvedValue(Response.json({ok:false},{status:409}));mount();fireEvent.submit(screen.getByRole('button').closest('form')!);
 expect(await screen.findByRole('alert')).toBeTruthy();expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({kind:'journal_proof_consent',expectedRevision:revision,apiNamespace:'2278454'});
 fireEvent.submit(screen.getByRole('button').closest('form')!);expect(fetcher).toHaveBeenCalledTimes(1);expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
});
it('cancels unmounted consent preparation and ignores a late result',async()=>{
 let finish!:(v:Response)=>void;fetcher.mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve}));const view=mount();fireEvent.submit(screen.getByRole('button').closest('form')!);const signal=fetcher.mock.calls[0][1].signal as AbortSignal;view.unmount();expect(signal.aborted).toBe(true);await act(async()=>finish(Response.json({ok:true,data:{status:'pending',configurationRevision:revision}})));expect(fetcher).toHaveBeenCalledTimes(1);
});
