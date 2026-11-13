import {afterEach, expect, it, vi} from 'vitest';
import * as http from 'node:http';
vi.mock('node:http',()=>({request:vi.fn()}));
import {EventEmitter} from 'node:events';
import {readNativeCustodianResponse} from '../nativeCustodianHttp';
function intercept(body: Buffer, status=200) {
 const response=Object.assign(new EventEmitter(),{statusCode:status,destroy:vi.fn()});
 const request=Object.assign(new EventEmitter(),{end:vi.fn(()=>queueMicrotask(()=>{request.emit('response',response);response.emit('data',body);response.emit('end')})),destroy:vi.fn()});
 const send=vi.mocked(http.request).mockReturnValue(request as unknown as http.ClientRequest);
 return {response,request,send};
}
afterEach(()=>{vi.resetAllMocks();vi.useRealTimers()});
it('uses one literal native origin and never ambient proxy, headers or redirects',async()=>{
 const io=intercept(Buffer.from('{"native":"synthetic"}'));
 expect(await readNativeCustodianResponse('/v2/credentials/11111111-1111-4111-8111-111111111111',new AbortController().signal)).toBe('{"native":"synthetic"}');
 expect(io.send).toHaveBeenCalledOnce();expect(io.send.mock.calls[0][0]).toEqual({hostname:'169.254.170.2',port:80,path:'/v2/credentials/11111111-1111-4111-8111-111111111111',method:'GET',agent:false,maxHeaderSize:8192,headers:{Accept:'application/json',Connection:'close'}});
});
it.each(['http://evil.invalid','//evil.invalid','/v2/credentials/../secret','/v2/credentials/a?x=y','/v2/credentials/a#fragment','/v2/credentials/a\r\nX: y','/v2/credentials/%2e%2e'])('refuses unsupported private coordinate %s before opening I/O',async path=>{
 const io=intercept(Buffer.from('{}'));await expect(readNativeCustodianResponse(path,new AbortController().signal)).rejects.toThrow('custodian_native_response_unavailable');expect(io.send).not.toHaveBeenCalled();
});
it.each([301,403,500])('refuses status %s without following or retrying',async status=>{
 const io=intercept(Buffer.from('PRIVATE_BODY'),status);await expect(readNativeCustodianResponse('/v2/credentials/a',new AbortController().signal)).rejects.toThrow('custodian_native_response_unavailable');expect(io.send).toHaveBeenCalledOnce();expect(io.request.destroy).toHaveBeenCalled();expect(io.response.destroy).toHaveBeenCalled();
});
it('bounds actual body bytes and refuses invalid UTF-8',async()=>{
 let io=intercept(Buffer.alloc(65537));await expect(readNativeCustodianResponse('/v2/credentials/a',new AbortController().signal)).rejects.toThrow('custodian_native_response_unavailable');expect(io.response.destroy).toHaveBeenCalled();vi.resetAllMocks();io=intercept(Buffer.from([255]));await expect(readNativeCustodianResponse('/v2/credentials/a',new AbortController().signal)).rejects.toThrow('custodian_native_response_unavailable');expect(io.send).toHaveBeenCalledOnce();
});
it('does not open a request after parent cancellation',async()=>{
 const io=intercept(Buffer.from('{}')),abort=new AbortController();abort.abort(Error('PRIVATE'));await expect(readNativeCustodianResponse('/v2/credentials/a',abort.signal)).rejects.toThrow('custodian_native_response_unavailable');expect(io.send).not.toHaveBeenCalled();
});
it('destroys a stalled request at the total deadline without another acquisition',async()=>{
 vi.useFakeTimers();const request=Object.assign(new EventEmitter(),{end:vi.fn(),destroy:vi.fn()});const send=vi.mocked(http.request).mockReturnValue(request as unknown as http.ClientRequest);const result=readNativeCustodianResponse('/v2/credentials/a',new AbortController().signal);const rejected=expect(result).rejects.toThrow('custodian_native_response_unavailable');await vi.advanceTimersByTimeAsync(3000);await rejected;expect(request.destroy).toHaveBeenCalledOnce();expect(send).toHaveBeenCalledOnce();
});
it('cancels an open response and ignores late successful data',async()=>{
 const controller=new AbortController(),response=Object.assign(new EventEmitter(),{statusCode:200,destroy:vi.fn()});
 const request=Object.assign(new EventEmitter(),{end:vi.fn(),destroy:vi.fn()});const send=vi.mocked(http.request).mockReturnValue(request as unknown as http.ClientRequest);
 const result=readNativeCustodianResponse('/v2/credentials/a',controller.signal);const rejected=expect(result).rejects.toThrow('custodian_native_response_unavailable');request.emit('response',response);response.emit('data',Buffer.from('partial'));controller.abort();response.emit('data',Buffer.from('{}'));response.emit('end');await rejected;expect(request.destroy).toHaveBeenCalledOnce();expect(response.destroy).toHaveBeenCalledOnce();expect(send).toHaveBeenCalledOnce();
});
it('cleans up truncated responses without leaking the raw native error',async()=>{
 const response=Object.assign(new EventEmitter(),{statusCode:200,destroy:vi.fn()});const request=Object.assign(new EventEmitter(),{end:vi.fn(),destroy:vi.fn()});vi.mocked(http.request).mockReturnValue(request as unknown as http.ClientRequest);const result=readNativeCustodianResponse('/v2/credentials/a',new AbortController().signal);const rejected=expect(result).rejects.toThrow(/^custodian_native_response_unavailable$/);request.emit('response',response);response.emit('data',Buffer.from('PRIVATE'));response.emit('error',Error('PRIVATE'));response.emit('close');await rejected;expect(response.destroy).toHaveBeenCalledOnce();
});
