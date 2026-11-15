/** File-only source-layout study. No effects, app launch or operational acceptance. */
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,expect,it,vi} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const closed=vi.hoisted(()=>({call:vi.fn(()=>{throw Error('presentation_study_external_effect_forbidden')}),config:Object.freeze({baseUrl:'https://example.invalid',sessionToken:undefined})}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({
 desktopClient:{config:closed.config,getContextRevision:()=>0,subscribeContext:()=>()=>{},hasAuth:()=>false,isPreviewMode:false},
 legacyApiError:closed.call,
}));
vi.mock('@tauri-apps/api/core',()=>({invoke:closed.call}));
vi.mock('@tauri-apps/plugin-shell',()=>({open:closed.call}));
vi.mock('@tauri-apps/plugin-store',()=>({load:closed.call}));
vi.mock('../../../desktop/src/lib/secureStorage',()=>({readSecret:closed.call,writeSecret:closed.call,clearSecret:closed.call}));
vi.mock('../../../desktop/src/lib/desktopPairing',()=>({signInWithBrowser:closed.call}));
vi.mock('../../../desktop/src/lib/activeDesktopCredential',()=>({retrySavedDesktopSignIn:closed.call,signOutDesktopCredentials:closed.call}));
vi.mock('../../../desktop/src/lib/apiKeyStore',()=>({verifyAndSaveApiKey:closed.call}));

import {DesktopSignInView} from '../../../desktop/src/views/DesktopSignInView';
import {DesktopAccessRequiredView} from '../../../desktop/src/views/DesktopAccessRequiredView';
import {WelcomeView} from '../../../desktop/src/views/WelcomeView';
import {DocsView} from '../../../desktop/src/views/DocsView';
import {Sidebar} from '../../../desktop/src/components/Sidebar';
import {TopBar} from '../../../desktop/src/components/TopBar';
import type {VerifiedDesktopIdentity} from '../../../desktop/src/lib/desktopClient';

afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks()});
it('captures actual pre-auth and workspace chrome markup with all operational effects closed',()=>{
 vi.stubGlobal('fetch',closed.call);
 const noAction=()=>{throw Error('presentation_study_action_forbidden')};
 const identity:VerifiedDesktopIdentity={kind:'api_key',organizationId:'synthetic-layout-workspace',capabilities:[],access:{allowed:false,code:'production_access_required',title:'Workspace access required',message:'This is synthetic layout content. No account or entitlement has been verified.',planTier:'synthetic-unverified',billingStatus:'inactive',accessRequestPath:'/access',pricingPath:'/plans'}};
 const workspaceIdentity:VerifiedDesktopIdentity={...identity,kind:'desktop_session',userId:'synthetic-layout-reviewer',access:{...identity.access,allowed:true,code:'active',title:'Synthetic active access',billingStatus:'active'}};
 const frames={
  'sign-in':renderToStaticMarkup(createElement(DesktopSignInView,{onSignedIn:noAction})),
  'sign-in-recovery':renderToStaticMarkup(createElement(DesktopSignInView,{onSignedIn:noAction,initialError:'Synthetic recovery notice: sign-in could not be verified. Your workspace remains locked.',canRetrySavedSignIn:true})),
  'access-required':renderToStaticMarkup(createElement(DesktopAccessRequiredView,{identity,onAccessGranted:noAction,onSignedOut:noAction})),
  welcome:renderToStaticMarkup(createElement('div',{className:'flex h-screen min-h-0'},createElement(Sidebar,{activeView:'agent',onNavigate:noAction,onOpenWelcome:noAction,homeVisible:true}),createElement('div',{className:'flex min-w-0 flex-1 flex-col'},createElement(TopBar,{activeView:'agent',identity:workspaceIdentity,welcome:true}),createElement(WelcomeView,{onBuild:noAction,onBot:noAction,onAutomate:noAction,onDeploy:noAction})))),
  docs:renderToStaticMarkup(createElement('div',{className:'flex h-screen min-h-0'},createElement(Sidebar,{activeView:'docs',onNavigate:noAction,onOpenWelcome:noAction}),createElement('div',{className:'flex min-w-0 flex-1 flex-col'},createElement(TopBar,{activeView:'docs',identity:workspaceIdentity}),createElement(DocsView,{onNavigate:noAction})))),
 };
 expect(frames['sign-in']).toContain('overflow-y-auto');
 expect(frames['sign-in-recovery']).toContain('Enterprise recovery sign-in');
 expect(frames['access-required']).toContain('Check access again');
 expect(frames.welcome).toContain('Your next move,');
 expect(frames.docs).toContain('Documentation');
 for(const html of [frames.welcome,frames.docs]){
  expect(html).toContain('Access active');
  expect(html).not.toContain('Access needs attention');
 }
 expect(frames['access-required']).not.toContain('Workspace connected');
 expect(closed.call).not.toHaveBeenCalled();
 // Explicit opt-in writes only a fixed local scratch artifact, never a product route.
 if(process.env.AXIOM_WRITE_PRESENTATION_STUDY==='1'){
  const directory=resolve(import.meta.dirname,'../../../work/desktop-presentation-study');
  mkdirSync(directory,{recursive:true});
  writeFileSync(resolve(directory,'SOURCE-MARKUP.json'),JSON.stringify({scope:'Static source-layout study. Effects and handlers do not run; not installed/native/authenticated acceptance.',frames},null,2)+'\n',{mode:0o600});
 }
});
