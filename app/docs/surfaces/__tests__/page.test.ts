/** @vitest-environment jsdom */
import {createElement} from 'react';
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import SurfacesPage from '../page';
vi.mock('next/navigation',()=>({redirect:vi.fn()}));
afterEach(cleanup);
it('answers the index destination with each registered desktop destination',()=>{
 render(createElement(SurfacesPage));
 expect(screen.getByRole('heading',{level:1}).textContent).toContain('Find the right place to work.');
 for(const name of ['Agent','Saved Tasks','Deployments','Tickets','Repositories','Batches','Apps & Skills','Documentation','Settings'])
  expect(screen.getByRole('heading',{name})).toBeTruthy();
});
it('separates browsing, review and provider effects without creating action controls',()=>{
 const {container}=render(createElement(SurfacesPage));
 for(const text of ['installed version','does not authorize a provider action','Airflow','not a registered customer destination','Do not resend an uncertain or consumed action','authorized requester and independent reviewer'])
  expect(container.textContent).toContain(text);
 expect(container.querySelector('form,input,button')).toBeNull();
});
it('offers public guidance and correctly labels authenticated help',()=>{
 render(createElement(SurfacesPage));
 for(const [name,href] of [['Download the desktop app','/download'],['Illustrative demo','/demo'],['Review and execution guidance','/docs/approval-workflow'],['Account help (sign-in required)','/account/help']])
  expect(screen.getByRole('link',{name}).getAttribute('href')).toBe(href);
});
it('documents the available desktop map controls and points readers back to the original record', () => {
 const {container} = render(createElement(SurfacesPage));
 const guide = container.querySelector('#workflow-map');
 expect(guide?.textContent).toContain('In desktop versions that include it');
 for (const label of ['Workflow map', 'Fit overview', 'Read the guide', 'Step list', 'Close details', 'Back to guides'])
  expect(guide?.textContent).toContain(label);
 expect(guide?.textContent).toContain('Use the original workspace record');
});
