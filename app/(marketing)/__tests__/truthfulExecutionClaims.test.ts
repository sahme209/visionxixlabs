/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import HowItWorksPage,{metadata} from '../how-it-works/page';
import {CapabilitiesClient} from '../capabilities/CapabilitiesClient';
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
