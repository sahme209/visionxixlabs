/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
const io=vi.hoisted(()=>({targets:vi.fn(),plan:vi.fn(),config:{}}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{releaseMergeTargets:io.targets,releaseMergePlan:io.plan,get config(){return io.config},subscribeContext:()=>()=>{},getContextRevision:()=>0}}));
import {ReleaseMergeReview} from '../../../desktop/src/components/ReleaseMergeReview';
const targets={requestId:'release',requestVersion:3,repositoryFullName:'team/service',targets:[{number:42,url:'https://github.com/team/service/pull/42'}]};
const plan={authority:'evidence_only',digest:'c'.repeat(64),plan:{kind:'merge_pull_request',organizationId:'org',requestId:'release',requestVersion:3,intakeDigest:'d'.repeat(64),connectionId:'install',connectionRevision:'2026-10-24T00:00:00Z',window:{startUtc:'2026-10-24T00:00:00Z',endUtc:'2026-10-24T01:00:00Z'},method:'squash',pullRequest:{repositoryFullName:'team/service',number:42,url:'https://github.com/team/service/pull/42',headRef:'release/demo',headSha:'a'.repeat(40),baseRef:'main',baseSha:'b'.repeat(40)}}};
beforeEach(()=>{io.config={};io.targets.mockResolvedValue({ok:true,data:targets});io.plan.mockResolvedValue({ok:true,data:plan})});
afterEach(()=>{cleanup();vi.clearAllMocks()});
async function select(){fireEvent.click(screen.getByText('Review merge'));await screen.findByLabelText('Linked pull request');fireEvent.change(screen.getByLabelText('Linked pull request'),{target:{value:'42'}});fireEvent.change(screen.getByLabelText('Merge method'),{target:{value:'squash'}})}
it('requires explicit target and method choices before reading a plan, and offers no merge action',async()=>{
 render(createElement(ReleaseMergeReview,{requestId:'release',version:3}));expect(io.targets).not.toHaveBeenCalled();fireEvent.click(screen.getByText('Review merge'));
 const selected=await screen.findByLabelText('Linked pull request');expect((selected as HTMLSelectElement).value).toBe('');expect(screen.getByText('Read merge plan').hasAttribute('disabled')).toBe(true);expect(io.plan).not.toHaveBeenCalled();
 fireEvent.change(selected,{target:{value:'42'}});fireEvent.change(screen.getByLabelText('Merge method'),{target:{value:'squash'}});fireEvent.click(screen.getByText('Read merge plan'));
 await screen.findByText('release/demo → main');expect(io.plan).toHaveBeenCalledWith('release',3,42,'squash','team/service');expect(screen.getByText('Review only. No merge will run.')).toBeDefined();expect(screen.queryByRole('button',{name:'Merge'})).toBeNull();
});
it('discards metadata from an old release version',async()=>{
 let resolve!:(v:unknown)=>void;io.targets.mockReturnValue(new Promise(r=>resolve=r));const view=render(createElement(ReleaseMergeReview,{requestId:'release',version:3}));fireEvent.click(screen.getByText('Review merge'));view.rerender(createElement(ReleaseMergeReview,{requestId:'release',version:4}));await act(async()=>resolve({ok:true,data:targets}));expect(screen.queryByLabelText('Linked pull request')).toBeNull();
});
it('discards a plan after the active connection changes',async()=>{
 let resolve!:(v:unknown)=>void;io.plan.mockReturnValue(new Promise(r=>resolve=r));const view=render(createElement(ReleaseMergeReview,{requestId:'release',version:3}));await select();fireEvent.click(screen.getByText('Read merge plan'));io.config={};view.rerender(createElement(ReleaseMergeReview,{requestId:'release',version:3}));await act(async()=>resolve({ok:true,data:plan}));expect(screen.queryByText('release/demo → main')).toBeNull();
});
it('clears prior evidence when the selected method changes',async()=>{
 render(createElement(ReleaseMergeReview,{requestId:'release',version:3}));await select();fireEvent.click(screen.getByText('Read merge plan'));await screen.findByText('release/demo → main');fireEvent.change(screen.getByLabelText('Merge method'),{target:{value:'merge'}});expect(screen.queryByText('release/demo → main')).toBeNull();
});
it('blocks malformed current-context responses without displaying raw errors',async()=>{
 io.targets.mockResolvedValue({ok:true,data:{...targets,requestVersion:9}});render(createElement(ReleaseMergeReview,{requestId:'release',version:3}));fireEvent.click(screen.getByText('Review merge'));await screen.findByRole('alert');expect(screen.queryByLabelText('Linked pull request')).toBeNull();
});
