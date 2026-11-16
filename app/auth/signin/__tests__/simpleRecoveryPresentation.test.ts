/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
const ports=vi.hoisted(()=>({error:'AccessDenied',configured:true,signIn:vi.fn(),push:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:ports.push,refresh:vi.fn()}),useSearchParams:()=>new URLSearchParams({error:ports.error,callbackUrl:'/desktop/connect?challenge=synthetic'})}));
vi.mock('next-auth/react',()=>({signIn:ports.signIn,getProviders:async()=>ports.configured?{google:{},github:{},cognito:{}}:{}}));
vi.mock('next/image',()=>({default:'img'}));
import SignInPage from '../AuthFormClient';
beforeEach(()=>{vi.clearAllMocks();ports.error='AccessDenied';ports.configured=true});
afterEach(cleanup);
it('offers primary Google before email and retains configured secondary methods in the disclosure',async()=>{
 render(createElement(SignInPage));
 const google=await screen.findByRole('button',{name:'Continue with Google'});
 fireEvent.click(screen.getByText('Other sign-in options'));
 const cognito=await screen.findByRole('button',{name:'Sign in with Cognito'});
 expect(screen.getByRole('button',{name:'Sign in with GitHub'})).toBeTruthy();
 const email=screen.getByLabelText('Email');
 expect(google.compareDocumentPosition(email)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(email.compareDocumentPosition(cognito)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(screen.queryByLabelText('Password')).toBeNull();
 fireEvent.change(email,{target:{value:'person@example.test'}});
 fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 expect(screen.getByLabelText('Password')).toBeTruthy();
 expect(screen.queryByRole('button',{name:/GitLab/i})).toBeNull();
 expect(ports.signIn).not.toHaveBeenCalled();expect(ports.push).not.toHaveBeenCalled();
});
it.each(['AccessDenied','OAuthCallback','private_untrusted_error_payload'])('shows safe recovery without reflecting the OAuth query value %s',async error=>{
 ports.error=error;render(createElement(SignInPage));
 const alert=await screen.findByRole('alert');
 expect(alert.textContent).toContain("couldn't complete sign-in");
 expect(alert.textContent).not.toContain(error);
 expect(alert.textContent).not.toContain('do not have permission');
 expect(ports.signIn).not.toHaveBeenCalled();expect(ports.push).not.toHaveBeenCalled();
});
it('keeps recovery visible even when no OAuth provider can currently be listed',async()=>{
 ports.configured=false;render(createElement(SignInPage));
 expect((await screen.findByRole('alert')).textContent).toContain("couldn't complete sign-in");
 expect(screen.getByLabelText('Email')).toBeTruthy();
});

it('requires an email before revealing password and never starts auth from Continue',async()=>{
 ports.error='';render(createElement(SignInPage));
 fireEvent.click(screen.getByText('Other sign-in options'));
 await screen.findByRole('button',{name:'Sign in with Cognito'});
 fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 expect(screen.queryByLabelText('Password')).toBeNull();
 fireEvent.change(screen.getByLabelText('Email'),{target:{value:'person@example.test'}});
 fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 expect(screen.getByLabelText('Password')).toBeTruthy();
 expect(ports.signIn).not.toHaveBeenCalled();expect(ports.push).not.toHaveBeenCalled();
});

it('keeps one actual contact destination in sign-in help before and after opening verification recovery',async()=>{
 ports.error='';render(createElement(SignInPage));
 fireEvent.click(screen.getByText('Other sign-in options'));
 await screen.findByRole('button',{name:'Sign in with Cognito'});
 const summary=screen.getByText('Need help signing in?');
 const help=summary.closest('details')!;
 fireEvent.click(summary);
 expect(within(help).getAllByRole('link',{name:'Contact support'})).toHaveLength(1);
 expect(within(help).getByRole('link',{name:'Contact support'}).getAttribute('href')).toBe('/contact');
 fireEvent.click(within(help).getByRole('button',{name:'Need a verification email?'}));
 expect(within(help).getByRole('region',{name:'Email verification recovery'})).toBeTruthy();
 expect(within(help).getAllByRole('link',{name:'Contact support'})).toHaveLength(1);
 expect(within(help).getByRole('link',{name:'Contact support'}).getAttribute('href')).toBe('/contact');
 expect(ports.signIn).not.toHaveBeenCalled();expect(ports.push).not.toHaveBeenCalled();
});

it('initially keeps secondary options and help inside one closed native disclosure',async()=>{
 ports.error='';render(createElement(SignInPage));
 const disclosure=screen.getByText('Other sign-in options').closest('details')!;
 expect(disclosure.open).toBe(false);
 // jsdom does not implement closed-details layout visibility; verify the
 // native closed ancestor rather than claiming rendered browser acceptance.
 expect(screen.getByRole('button',{name:'Sign in with GitHub'}).closest('details')).toBe(disclosure);
 expect(screen.getByRole('link',{name:'Return to downloads →'}).closest('details')).toBe(disclosure);
 const google=screen.getByRole('button',{name:'Continue with Google'});
 expect(google.textContent).toContain('Continue with Google');
 expect(screen.getByPlaceholderText('Enter your work email…')).toBe(screen.getByLabelText('Email'));
 expect(screen.queryByLabelText('Password')).toBeNull();
 expect(screen.getByText('Need help signing in?').closest('details')?.parentElement?.closest('details')).toBe(disclosure);
 expect(screen.getByRole('link',{name:'vxix home'}).querySelector('img')?.getAttribute('src')).toBe('/brand/vxix-mark.svg');
 fireEvent.click(screen.getByText('Other sign-in options'));
 expect(disclosure.open).toBe(true);
 expect(await screen.findByRole('button',{name:'Sign in with Cognito'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Sign in with GitHub'})).toBeTruthy();
 fireEvent.click(screen.getByText('Other sign-in options'));
 expect(disclosure.open).toBe(false);
 expect(ports.signIn).not.toHaveBeenCalled();expect(ports.push).not.toHaveBeenCalled();
});
