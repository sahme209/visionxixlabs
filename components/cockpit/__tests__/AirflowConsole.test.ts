/** @vitest-environment jsdom */
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AirflowConsole } from '../AirflowConsole';
const call=vi.fn();
const overview={connection:{status:'active',version:'3.1',lastValidatedAt:'2026-10-01',dagCount:1},automations:[],executions:[]};
beforeEach(()=>{vi.stubGlobal('fetch',call);call.mockReset();call.mockImplementation(async(url:string)=>new Response(JSON.stringify({ok:true,data:url.includes('view=tasks')?{tasks:[{taskId:'extract',mapIndex:-1,tryNumber:1,state:'success',startedAt:null,endedAt:null}],totalEntries:1,offset:0}:url.includes('view=runs')?{runs:[{dagId:'daily',dagRunId:'run-1',state:'success',startedAt:null,endedAt:null}]}:url.includes('view=dags')?{dags:[{dagId:'daily',displayName:'Daily import',paused:false,description:'Import',owners:[],tags:[]}]}:overview}),{status:200}));});
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('reads connection records first and drills from DAGs to runs and tasks',async()=>{
 render(createElement(AirflowConsole));await screen.findByText('Recorded connection: active');
 expect(call).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Load DAGs'}));await screen.findByText('Daily import');
 fireEvent.click(screen.getByRole('button',{name:'View runs for Daily import'}));await screen.findByText('run-1');
 fireEvent.click(screen.getByRole('button',{name:'View tasks for run-1'}));await screen.findByText('extract');
 expect(call.mock.calls.map(c=>String(c[0])).join('|')).toContain('view=tasks&dag=daily&run=run-1&offset=0');
 fireEvent.click(screen.getByRole('button',{name:'Back to DAGs'}));expect(screen.getByText('Daily import')).toBeTruthy();
 expect(screen.queryByRole('button',{name:/trigger|approve|disconnect/i})).toBeNull();
});
it('shows missing setup honestly and provides internal setup navigation',async()=>{
 call.mockResolvedValue(new Response(JSON.stringify({ok:true,data:{...overview,connection:{status:'not_connected'}}}),{status:200}));
 render(createElement(AirflowConsole));await screen.findByText('Recorded connection: not connected');
 expect(screen.getByRole('button',{name:'Load DAGs'}).hasAttribute('disabled')).toBe(true);
 expect(screen.getByRole('link',{name:'Agent setup & downloads'}).getAttribute('href')).toBe('/control/desktop');
});
it('does not claim an empty list after a failed provider read',async()=>{
 render(createElement(AirflowConsole));await screen.findByText('Recorded connection: active');
 call.mockResolvedValue(new Response(JSON.stringify({ok:false,error:'secret-provider-error'}),{status:502}));
 fireEvent.click(screen.getByRole('button',{name:'Load DAGs'}));await waitFor(()=>expect(screen.getByRole('alert')).toBeTruthy());
 expect(screen.queryByText('No DAGs returned.')).toBeNull();expect(document.body.textContent).not.toContain('secret-provider');
});
