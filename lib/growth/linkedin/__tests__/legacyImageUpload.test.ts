import {it,expect,vi,afterEach} from 'vitest';
import {uploadImageToLinkedIn} from '../imageUpload';
afterEach(()=>vi.unstubAllGlobals());
it('a raw caller token is not image-upload authority and cannot reach either provider request',async()=>{
 const http=vi.fn(async()=>Response.json({value:{uploadUrl:'https://unqualified.example.test/upload',uploadUrlExpiresAt:Date.now()+60000,image:'urn:li:image:fixture'}}));vi.stubGlobal('fetch',http);
 expect(await uploadImageToLinkedIn({accessToken:'synthetic-caller-token',owner:'urn:li:person:author',bytes:Buffer.from('image')})).toEqual({kind:'governance_required'});expect(http).not.toHaveBeenCalled();
});
