// @vitest-environment jsdom
import {createElement,Fragment} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {readdirSync,writeFileSync} from 'node:fs';
vi.mock('next/navigation',()=>({usePathname:()=>'/'}));
vi.mock('next/link',()=>({default:({children,href,onNavigate,...props}:any)=>createElement('a',{...props,href},children)}));
vi.mock('next/image',()=>({default:({src,alt,priority,fill,...props}:any)=>createElement('img',{...props,src:'axiom.png',alt})}));
vi.mock('../OrbitalBackdrop',()=>({OrbitalBackdrop:()=>{throw Error('Removed artwork must never mount')}}));
import {AxiomPublicHero} from '../AxiomPublicHero';
import {Navigation} from '@/components/Navigation';
afterEach(cleanup);
it('presents product context and real destinations without mounting removed decorative rendering',()=>{
 const view=render(createElement(AxiomPublicHero));
 expect(screen.getByRole('heading',{level:1,name:'Deploy with clarity.'})).toBeDefined();
 for(const [name,href] of [['Download Axiom Agent','/download'],['Explore Axiom','/product'],['Explore the scripted tour','/demo']])expect(screen.getByRole('link',{name}).getAttribute('href')).toBe(href);
 expect(view.container.querySelector('canvas,video')).toBeNull();
 expect(screen.getByText(/sample data/)).toBeDefined();
 expect(screen.getByText(/Complete Governance enforcement and activation are not established/)).toBeDefined();
 expect(screen.queryByRole('button')).toBeNull();
});
it('server renders complete readable sample content without an account or client effects',()=>{
 const markup=renderToStaticMarkup(createElement(AxiomPublicHero));
 expect(markup).toContain('Independent review required');
 expect(markup).toContain('Outcome not yet verified');
 expect(markup).not.toMatch(/<canvas|<video|vortex|orbit-backdrop/);
 if(process.env.AXIOM_PUBLIC_HERO_STUDY==='1'){
  const assets='work/visual-orbit-preview/assets/exact-only';
  const sheets=readdirSync(assets).filter(name=>name.endsWith('.css')).map(name=>`<link rel="stylesheet" href="assets/exact-only/${name}">`).join('');
  const body=renderToStaticMarkup(createElement(Fragment,null,createElement(Navigation),createElement('main',null,createElement(AxiomPublicHero))));
  writeFileSync('work/visual-orbit-preview/axiom-exact-only.html',`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Axiom · Exact direction review</title>${sheets}<link rel="stylesheet" href="exact-only-fonts.css"><link rel="stylesheet" href="exact-only-public.css"><style>html,body{margin:0;background:#0a0908;color:white}.site-navigation>div{max-width:1128px}.public-home-painting .desktop-demo-frame{font-family:Inter,sans-serif}</style></head><body>${body}</body></html>`);
 }
});
