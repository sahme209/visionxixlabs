import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const ports=vi.hoisted(()=>({host:'visionxixlabs.com',getCookie:vi.fn(),redirect:vi.fn((url:string)=>{throw new Error('REDIRECT:'+url)})}));
vi.mock('next/headers',()=>({headers:async()=>new Headers({host:ports.host,'x-forwarded-host':'evil.test'}),cookies:async()=>({get:ports.getCookie})}));
vi.mock('next/navigation',()=>({redirect:ports.redirect}));
import ErrorPage from '../page';
import {NextRequest} from 'next/server';
beforeEach(()=>{vi.clearAllMocks();ports.host='visionxixlabs.com';vi.stubEnv('NEXTAUTH_URL','https://visionxixlabs.com');ports.getCookie.mockReturnValue({value:'https://visionxixlabs.com/desktop/connect?challenge=synthetic'})});
afterEach(()=>vi.unstubAllEnvs());
it('recovers the existing callback cookie before returning to the simple sign-in form',async()=>{
 await expect(ErrorPage()).rejects.toThrow('REDIRECT:/auth/signin?error=SignInFailed&callbackUrl=%2Fdesktop%2Fconnect%3Fchallenge%3Dsynthetic');
 expect(ports.getCookie).toHaveBeenCalledExactlyOnceWith('__Secure-next-auth.callback-url');
});
it('drops a foreign return without relaxing the login denial',async()=>{
 ports.getCookie.mockReturnValue({value:'https://evil.test/desktop/connect'});
 await expect(ErrorPage()).rejects.toThrow('REDIRECT:/auth/signin?error=SignInFailed');
});
it('hands an alias to the configured error route before reading any callback cookie',async()=>{
 ports.host='www.visionxixlabs.com';
 await expect(ErrorPage()).rejects.toThrow('REDIRECT:https://visionxixlabs.com/auth/error');
 expect(ports.getCookie).not.toHaveBeenCalled();
});
it('renders a configuration-unavailable recovery without requiring authentication or a cookie',async()=>{
 vi.stubEnv('NEXTAUTH_URL','');const rendered=await ErrorPage();expect(rendered).toBeTruthy();expect(ports.redirect).not.toHaveBeenCalled();expect(ports.getCookie).not.toHaveBeenCalled();
});

it('uses the actual NextRequest decoded cookie value for a desktop retry',async()=>{
 const callback='https://visionxixlabs.com/desktop/connect?challenge=synthetic%2Bpair&intent=sign_in';
 const req=new NextRequest('https://visionxixlabs.com/auth/error',{headers:{cookie:'__Secure-next-auth.callback-url='+encodeURIComponent(callback)}});
 ports.getCookie.mockImplementation(name=>req.cookies.get(name));
 await expect(ErrorPage()).rejects.toThrow('REDIRECT:/auth/signin?error=SignInFailed&callbackUrl=%2Fdesktop%2Fconnect%3Fchallenge%3Dsynthetic%252Bpair%26intent%3Dsign_in');
});
it('uses only the local plain cookie on an explicitly configured localhost origin',async()=>{
 ports.host='localhost:3000';vi.stubEnv('NEXTAUTH_URL','http://localhost:3000');ports.getCookie.mockReturnValue({value:'/desktop/connect?challenge=synthetic'});
 await expect(ErrorPage()).rejects.toThrow('REDIRECT:/auth/signin?error=SignInFailed&callbackUrl=%2Fdesktop%2Fconnect%3Fchallenge%3Dsynthetic');
 expect(ports.getCookie).toHaveBeenCalledExactlyOnceWith('next-auth.callback-url');
});
it('keeps the default sign-in destination when the original callback cookie is absent',async()=>{
 ports.getCookie.mockReturnValue(undefined);await expect(ErrorPage()).rejects.toThrow('REDIRECT:/auth/signin?error=SignInFailed');
});
