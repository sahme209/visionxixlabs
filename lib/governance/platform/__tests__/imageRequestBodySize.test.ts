import {expect,it} from 'vitest';
import {readBoundedRequestJsonWithSize} from '@/lib/api/readBoundedRequestJson';
it('reports original UTF8 request bytes including whitespace without a second body read',async()=>{const text=' \n '+JSON.stringify({text:'é'})+' ';const request=new Request('https://local.test/image',{method:'POST',body:text});expect(await readBoundedRequestJsonWithSize(request,new AbortController().signal,100)).toEqual({value:{text:'é'},byteLength:new TextEncoder().encode(text).length});expect(request.bodyUsed).toBe(true)});
