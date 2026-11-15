/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import HowItWorksPage,{metadata} from '../how-it-works/page';
import {CapabilitiesClient} from '../capabilities/CapabilitiesClient';
import ManifestoPage,{metadata as manifestoMetadata} from '../../manifesto/page';
import EnterpriseReadinessPage from '../../enterprise-readiness/page';
vi.mock('@/components/motion/SectionRail',()=>({SectionRail:()=>null}));
vi.mock('framer-motion',async()=>{const React=await import('react');const cache=new Map();return{useReducedMotion:()=>true,motion:new Proxy({},{get:(_,tag:string)=>{if(!cache.has(tag))cache.set(tag,({children,initial,animate,whileInView,viewport,transition,...props}:Record<string,unknown>)=>React.createElement(tag,props,children as React.ReactNode));return cache.get(tag)}})}});
vi.mock('next/link',()=>({default:({children,href}:{children:React.ReactNode;href:string})=>createElement('a',{href},children)}));
afterEach(cleanup);
it('mounted walkthrough separates prepared review from real supported execution without type-safety absolutes',()=>{
 render(createElement(HowItWorksPage));
 expect(screen.getByText(/supported operations can make real changes/i)).toBeDefined();
 expect(screen.getByText(/staged plan is not a completed action/i)).toBeDefined();
 expect(screen.getByText(/runtime validation where implemented/i)).toBeDefined();
 expect(document.body.textContent).not.toMatch(/never auto-applies|only stages|never reach prod|hallucinated values break the build/i);
 expect(metadata.description).toMatch(/review.*execution/i);
 expect(metadata.description).not.toMatch(/nothing is auto-applied/i);
});
it('mounted capabilities describes a pure policy decision without claiming signed approval or universal admission',()=>{
 render(createElement(CapabilitiesClient));
 expect(screen.getByText(/supplied rules and context/i)).toBeDefined();
 expect(screen.getByText(/not a signed approval or universal execution admission/i)).toBeDefined();
 expect(document.body.textContent).not.toMatch(/operator-signed scope|tenant charter to every proposal/i);
 expect(screen.getByText(/do not claim live cloud mutation/i)).toBeDefined();
});
it('mounted manifesto distinguishes design principles from universal runtime, audit and credential guarantees',()=>{
 render(createElement(ManifestoPage));
 expect(document.body.textContent).toMatch(/complete Governance coverage and activation remain unfinished/i);
 expect(document.body.textContent).toMatch(/external input, current permissions and actual outcomes still need validation/i);
 expect(document.body.textContent).toMatch(/not signatures on every action or tamper prevention/i);
 expect(document.body.textContent).toMatch(/some integrations retain encrypted, context-bound credentials/i);
 expect(document.body.textContent).not.toMatch(/every change we propose passes|sha-256-signed|production accounts cap at one|we don't store credentials|trust scales linearly/i);
 expect(manifestoMetadata.description).not.toMatch(/audit-immutable/i);
});
it('mounted enterprise inventory separates source scope from verified delivery and installer availability',()=>{
 render(createElement(EnterpriseReadinessPage));
 expect(screen.getByRole('heading',{name:'Implementation and evidence'})).toBeDefined();
 expect(document.body.textContent).toMatch(/not proof of a released customer workflow or verified provider outcome/i);
 expect(document.body.textContent).toMatch(/live health and recovery acceptance remain unverified/i);
 expect(document.body.textContent).toMatch(/review installer availability and verification details/i);
 expect(document.body.textContent).not.toMatch(/released governance boundary|install the current signed release/i);
});
