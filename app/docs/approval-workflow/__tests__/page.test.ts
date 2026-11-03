import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import ApprovalWorkflowPage from '../page';
it('keeps separate requester execution explicitly local and unavailable in production',()=>{
 const html=renderToStaticMarkup(ApprovalWorkflowPage());
 expect(html).toContain('local preview and is not production-activated');
 expect(html).toContain('may not include an Execute control');
 expect(html).not.toContain('The released boundary');
});
it('preserves independent approval while documenting that the requester executes separately',()=>{
 const html=renderToStaticMarkup(ApprovalWorkflowPage());
 expect(html).toContain('approval records review only');
 expect(html).toContain('original requester');
 expect(html).toContain('current approval permission');
 expect(html).toContain('Medium risk:');expect(html).toContain('require approval');
 expect(html).not.toContain('scoped responder');
 expect(html).not.toContain('workspace administrator must approve');
 expect(html).toContain('Approval or dispatch acceptance does not verify ECS execution');
});
