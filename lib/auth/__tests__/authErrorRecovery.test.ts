import {expect,it} from 'vitest';
import {authErrorRecoveryCallback,authErrorCallbackCookie} from '../authErrorRecovery';
const origin='https://visionxixlabs.com';
it('retains an original same-origin desktop pairing return without exposing authority',()=>{
 expect(authErrorRecoveryCallback(origin+'/desktop/connect?challenge=synthetic&intent=sign_in',origin)).toBe('/desktop/connect?challenge=synthetic&intent=sign_in');
 expect(authErrorRecoveryCallback('/control',origin)).toBe('/control');
});
it.each([undefined,'','https://evil.test/desktop/connect','//evil.test','/\\evil.test','/\nevil','javascript:alert(1)','https://user:pass@visionxixlabs.com/control','/auth/error','/auth/signin?error=again','/api/auth/error','not-a-path'])('refuses unsafe, missing or recursive callback %s',value=>{
 expect(authErrorRecoveryCallback(value,origin)).toBeNull();
});
it('selects only the actual transport-specific NextAuth callback cookie',()=>{
 expect(authErrorCallbackCookie(origin)).toBe('__Secure-next-auth.callback-url');
 expect(authErrorCallbackCookie('http://localhost:3000')).toBe('next-auth.callback-url');
});

it.each(['/auth/%65rror','/%61uth/signin','/%2fauth/error','/api/%61uth/callback/google','/auth/../auth/error','/control%0a','/control%5cnext','/control%ZZ'])('rejects encoded or normalized recursive/malformed paths %s',value=>{
 expect(authErrorRecoveryCallback(value,origin)).toBeNull();
});
it('refuses invalid configured origins instead of selecting a cookie or trusting a caller URL',()=>{
 expect(authErrorCallbackCookie('http://evil.test')).toBeNull();
 expect(authErrorRecoveryCallback('/control','http://evil.test')).toBeNull();
});
