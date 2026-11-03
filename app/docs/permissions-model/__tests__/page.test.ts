import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import PermissionsModelPage,{metadata} from '../page';
it('labels separate execution as a local preview without implying production availability',()=>{
 const html=renderToStaticMarkup(PermissionsModelPage());
 expect(html).toContain('Preview workflow reference');
 expect(html).toContain('local preview and is not production-activated');
 expect(html).toContain('may not include an Execute control');
 expect(metadata.description).not.toContain('released');
});
it('distinguishes capability checks, independent review and requester execution without universal approval claims',()=>{
 const html=renderToStaticMarkup(PermissionsModelPage());
 expect(html).toContain('approval authority is distinct from permission to execute');
 expect(html).toContain('authorized independent reviewer');
 expect(html).toContain('original requester uses Execute');
 expect(html).not.toContain('Writes require an authorized approval path');
 expect(html).not.toContain('invokes the real write after');
 expect(html).not.toContain('authenticated administrator action');
});
