/** @vitest-environment jsdom */
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{}}));
import {ProposalCard} from '../../../desktop/src/views/AgentChatView';
afterEach(cleanup);
it('explains an independent reviewer requirement while allowing proposal cancellation',()=>{
 const approve=vi.fn(),reject=vi.fn();
 render(createElement(ProposalCard,{proposal:{id:'proposal',toolName:'create_github_branch',argsJson:{repositoryFullName:'fixture/repository',baseBranch:'main',newBranchName:'scratch'},riskLevel:'medium',status:'proposed',requiresIndependentReviewer:true},deciding:false,onApprove:approve,onReject:reject}));
 expect(screen.getByText(/Another authorized reviewer must approve/)).toBeTruthy();
 const run=screen.getByRole('button',{name:'Record approval'});
 expect((run as HTMLButtonElement).disabled).toBe(true);fireEvent.click(run);expect(approve).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Cancel proposal'}));expect(reject).toHaveBeenCalledOnce();
});
