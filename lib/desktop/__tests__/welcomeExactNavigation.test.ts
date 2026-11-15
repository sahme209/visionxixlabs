/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {WelcomeView} from '../../../desktop/src/views/WelcomeView';

afterEach(cleanup);
it('keeps each launch choice bound to its existing navigation callback only',()=>{
 const callbacks={onBuild:vi.fn(),onBot:vi.fn(),onAutomate:vi.fn(),onDeploy:vi.fn()};
 render(createElement(WelcomeView,callbacks));
 for(const [name,key] of [['Open Agent','onBuild'],['Delegate a task','onBot'],['Plan a release','onDeploy'],['Review operations','onAutomate']] as const){
  for(const fn of Object.values(callbacks))fn.mockClear();
  fireEvent.click(screen.getByRole('button',{name:new RegExp(name)}));
  expect(callbacks[key]).toHaveBeenCalledTimes(1);
  for(const [other,fn] of Object.entries(callbacks))if(other!==key)expect(fn).not.toHaveBeenCalled();
 }
});
it('presents artwork as decoration and keeps navigation and connection limits explicit',()=>{
 const view=render(createElement(WelcomeView,{onBuild:vi.fn(),onBot:vi.fn(),onAutomate:vi.fn(),onDeploy:vi.fn()}));
 expect(screen.getByRole('heading',{level:1,name:/Your next move.*in focus/})).toBeDefined();
 expect(screen.getByText(/Opening a section does not execute a change/)).toBeDefined();
 expect(screen.getByText(/Requires an Airflow connection/)).toBeDefined();
 expect(view.container.querySelector('.home-landscape')?.getAttribute('aria-hidden')).toBe('true');
 expect(view.container.querySelector('.home-landscape img')?.getAttribute('alt')).toBe('');
});
