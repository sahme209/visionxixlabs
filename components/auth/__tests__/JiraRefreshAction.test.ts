/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {JiraRefreshAction} from '../JiraRefreshAction';
const fetcher=vi.fn(),revision='2026-10-28T19:54:37.371Z';
beforeEach(()=>{vi.stubGlobal('fetch',fetcher);fetcher.mockReset()});
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
const mount=()=>render(createElement(JiraRefreshAction,{connectionId:'connection',revision}));
it('sends one explicit request and explains new-review requirement without claiming provider health',async()=>{fetcher.mockResolvedValue(Response.json({ok:true,data:{connectionId:'connection',revision,refreshed:true,connectionReadinessVerified:false}}));mount();fireEvent.click(screen.getByRole('button'));expect(await screen.findByText(/Connection token checked/)).toBeTruthy();expect(fetcher).toHaveBeenCalledTimes(1);expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({connectionId:'connection',revision});expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);expect(screen.queryByText('Connected')).toBeNull()});
it('keeps a failed or wrong-connection response non-retryable',async()=>{fetcher.mockResolvedValue(Response.json({ok:true,data:{connectionId:'other',revision,refreshed:true,connectionReadinessVerified:false}}));mount();fireEvent.click(screen.getByRole('button'));expect(await screen.findByText(/refresh was not confirmed/)).toBeTruthy();fireEvent.click(screen.getByRole('button'));expect(fetcher).toHaveBeenCalledTimes(1)});
it('aborts on unmount and ignores the late result',async()=>{let finish!:(v:Response)=>void;fetcher.mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve}));const view=mount();fireEvent.click(screen.getByRole('button'));const signal=fetcher.mock.calls[0][1].signal as AbortSignal;view.unmount();expect(signal.aborted).toBe(true);await act(async()=>finish(Response.json({ok:true})));expect(fetcher).toHaveBeenCalledTimes(1)});
