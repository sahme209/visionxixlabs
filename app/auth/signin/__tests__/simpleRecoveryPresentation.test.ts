/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
const ports=vi.hoisted(()=>({error:'AccessDenied',configured:true,signIn:vi.fn(),push:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:ports.push,refresh:vi.fn()}),useSearchParams:()=>new URLSearchParams({error:ports.error,callbackUrl:'/desktop/connect?challenge=synthetic'})}));
vi.mock('next-auth/react',()=>({signIn:ports.signIn,getProviders:async()=>ports.configured?{google:{},github:{},cognito:{},gitlab:{}}:{}}));
vi.mock('next/image',()=>({default:'img'}));
import SignInPage from '../AuthFormClient';
beforeEach(()=>{vi.clearAllMocks();ports.error='AccessDenied';ports.configured=true});
afterEach(cleanup);
it('offers primary Google before email and configured secondary methods directly below Continue',async()=>{
 render(createElement(SignInPage));
 const google=await screen.findByRole('button',{name:'Continue with Google'});
 const cognito=await screen.findByRole('button',{name:'Sign in with Cognito'});
 expect(screen.getByRole('button',{name:'Sign in with GitHub'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Sign in with GitLab'})).toBeTruthy();
 const email=screen.getByLabelText('Email');
 expect(google.compareDocumentPosition(email)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(email.compareDocumentPosition(cognito)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(screen.queryByLabelText('Password')).toBeNull();
 fireEvent.change(email,{target:{value:'person@example.test'}});
 fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 expect(screen.getByLabelText('Password')).toBeTruthy();
 expect(screen.queryByRole('button',{name:/Okta/i})).toBeNull();
 expect(ports.signIn).not.toHaveBeenCalled();expect(ports.push).not.toHaveBeenCalled();
});
it.each(['AccessDenied','OAuthCallback','private_untrusted_error_payload'])('shows safe recovery without reflecting the OAuth query value %s',async error=>{
 ports.error=error;render(createElement(SignInPage));
 const alert=await screen.findByRole('alert');
 expect(alert.textContent).toContain("couldn't complete sign-in");
 expect(alert.textContent).not.toContain(error);
 expect(alert.textContent).not.toContain('do not have permission');
 expect(screen.queryByRole('link',{name:/contact support/i})).toBeNull();
 expect(ports.signIn).not.toHaveBeenCalled();expect(ports.push).not.toHaveBeenCalled();
});
it('keeps recovery visible even when no OAuth provider can currently be listed',async()=>{
 ports.configured=false;render(createElement(SignInPage));
 expect((await screen.findByRole('alert')).textContent).toContain("couldn't complete sign-in");
 expect(screen.getByLabelText('Email')).toBeTruthy();
});

it('requires an email before revealing password and never starts auth from Continue',async()=>{
 ports.error='';render(createElement(SignInPage));
 await screen.findByRole('button',{name:'Sign in with Cognito'});
 fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 expect(screen.queryByLabelText('Password')).toBeNull();
 fireEvent.change(screen.getByLabelText('Email'),{target:{value:'person@example.test'}});
 fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 expect(screen.getByLabelText('Password')).toBeTruthy();
 expect(ports.signIn).not.toHaveBeenCalled();expect(ports.push).not.toHaveBeenCalled();
});

it('keeps the regular form free of help, verification, account-setup and download clutter',async()=>{
 ports.error='';render(createElement(SignInPage));
 await screen.findByRole('button',{name:'Sign in with Cognito'});
 expect(screen.queryByText('Other sign-in options')).toBeNull();
 expect(screen.queryByText('Need help signing in?')).toBeNull();
 expect(screen.queryByRole('button',{name:'Need a verification email?'})).toBeNull();
 expect(screen.queryByRole('region',{name:'Email verification recovery'})).toBeNull();
 expect(screen.queryByRole('link',{name:'Contact support'})).toBeNull();
 expect(screen.queryByRole('link',{name:'Set up through V19'})).toBeNull();
 expect(screen.queryByRole('link',{name:'Create one'})).toBeNull();
 expect(screen.queryByRole('link',{name:'Return to downloads →'})).toBeNull();
 expect(ports.signIn).not.toHaveBeenCalled();expect(ports.push).not.toHaveBeenCalled();
});

it('keeps VXIX branding and the Google/email sequence while providers remain distinct non-submit actions',async()=>{
 ports.error='';render(createElement(SignInPage));
 await screen.findByRole('button',{name:'Sign in with GitLab'});
 const google=screen.getByRole('button',{name:'Continue with Google'});
 expect(google.textContent).toContain('Continue with Google');
 expect(screen.getByPlaceholderText('Enter your work email…')).toBe(screen.getByLabelText('Email'));
 expect(screen.queryByLabelText('Password')).toBeNull();
 expect(screen.getByRole('link',{name:'vxix home'}).querySelector('img')?.getAttribute('src')).toBe('/brand/vxix-mark.svg');
 const submit=screen.getByRole('button',{name:'Continue'});
 for(const name of ['GitHub','Cognito','GitLab']){
  const button=screen.getByRole('button',{name:`Sign in with ${name}`});
  expect(button.getAttribute('type')).toBe('button');
  expect(submit.compareDocumentPosition(button)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 }
 expect(ports.signIn).not.toHaveBeenCalled();expect(ports.push).not.toHaveBeenCalled();
});

it.each([['GitHub','github'],['Cognito','cognito'],['GitLab','gitlab']])('starts only the selected configured %s provider with the original safe callback',async(label,id)=>{
 ports.error='';render(createElement(SignInPage));
 fireEvent.click(await screen.findByRole('button',{name:`Sign in with ${label}`}));
 await waitFor(()=>expect(ports.signIn).toHaveBeenCalledWith(id,{callbackUrl:'/desktop/connect?challenge=synthetic',redirect:true}));
 expect(ports.signIn).toHaveBeenCalledTimes(1);expect(ports.push).not.toHaveBeenCalled();
});

it('does not advertise secondary providers when the server registers none',async()=>{
 ports.error='';ports.configured=false;render(createElement(SignInPage));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Continue with Google'})).toBeNull());
 for(const name of ['GitHub','Cognito','GitLab','Okta'])expect(screen.queryByRole('button',{name:`Sign in with ${name}`})).toBeNull();
 expect(screen.getByLabelText('Email')).toBeTruthy();
 expect(ports.signIn).not.toHaveBeenCalled();
});

it("offers verification recovery only for an invalid verification return", async () => {
 ports.error='VerificationLinkInvalid';render(createElement(SignInPage));
 expect((await screen.findByRole('alert')).textContent).toContain("invalid, expired, or has already been used");
 const recovery=screen.getByRole('region',{name:'Email verification recovery'});
 expect(recovery.contains(screen.getByRole('button',{name:'Request verification link'}))).toBe(true);
 expect(screen.getByLabelText('Verification email address')).toBeTruthy();
 expect(screen.getByLabelText('Email')).toBeTruthy();
 expect(ports.signIn).not.toHaveBeenCalled();
});
