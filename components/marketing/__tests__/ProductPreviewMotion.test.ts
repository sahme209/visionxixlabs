/** @vitest-environment jsdom */
import {createElement} from 'react';
import {act,cleanup,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {AxiomPublicHero} from '../AxiomPublicHero';
import {IntegrationConnectionsScene} from '../IntegrationConnectionsScene';
import {publicCatalogEntries} from '@/lib/integrations/publicIntegrationCatalog';
let observers:Array<{callback:IntersectionObserverCallback;disconnect:ReturnType<typeof vi.fn>}>;
let mediaListeners:Set<()=>void>,reduced:boolean,hidden:boolean;
let intervals:ReturnType<typeof vi.spyOn>;
const oldHidden=Object.getOwnPropertyDescriptor(document,'hidden');
beforeEach(()=>{
 vi.useFakeTimers();intervals=vi.spyOn(window,"setInterval");observers=[];mediaListeners=new Set();reduced=false;hidden=false;
 Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});
 vi.stubGlobal('matchMedia',vi.fn(()=>({get matches(){return reduced},addEventListener:(_name:string,fn:()=>void)=>mediaListeners.add(fn),removeEventListener:(_name:string,fn:()=>void)=>mediaListeners.delete(fn)})));
 vi.stubGlobal('IntersectionObserver',class{disconnect=vi.fn();constructor(callback:IntersectionObserverCallback){observers.push({callback,disconnect:this.disconnect})}observe(){}unobserve(){}});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers();vi.unstubAllGlobals();if(oldHidden)Object.defineProperty(document,'hidden',oldHidden);else delete (document as {hidden?:boolean}).hidden});
const board=()=>document.querySelector('.public-home-workspace')!;
function notify(visible=true,index=0){expect(observers.length).toBeGreaterThan(0);act(()=>observers[index].callback([{isIntersecting:visible,intersectionRatio:visible?1:0} as IntersectionObserverEntry],{} as IntersectionObserver))}
const advance=(ms:number)=>act(()=>vi.advanceTimersByTime(ms));
it('animates the original request illustration once on entry, then settles within five seconds',()=>{
 render(createElement(AxiomPublicHero));notify();expect(board().getAttribute('data-preview-active')).toBe('true');advance(2400);
 expect(Number(board().getAttribute('data-preview-progress'))).toBeGreaterThan(0);expect(Number(board().getAttribute('data-preview-progress'))).toBeLessThan(1);
 advance(2600);expect(board().getAttribute('data-preview-progress')).toBe('1');expect(board().getAttribute('data-preview-active')).toBe('false');
 expect(vi.getTimerCount()).toBe(0);notify(false);notify();expect(board().getAttribute('data-preview-active')).toBe('false');
 expect(screen.queryByRole('button',{name:/play|pause|replay/i})).toBeNull();
});
it('retains all source and review facts throughout motion without running any request',()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);render(createElement(AxiomPublicHero));notify();advance(1200);
 expect(screen.getByText(/acme\/customer-web/)).toBeTruthy();expect(screen.getByText(/Production execution is held/)).toBeTruthy();
 expect(screen.getByText('Independent review required')).toBeTruthy();expect(fetch).not.toHaveBeenCalled();
});
it('pauses when outside the viewport and resumes only the remaining finite reveal',()=>{
 render(createElement(AxiomPublicHero));notify();advance(1200);notify(false);const progress=board().getAttribute('data-preview-progress');advance(6000);
 expect(board().getAttribute('data-preview-progress')).toBe(progress);expect(vi.getTimerCount()).toBe(0);notify();advance(4000);
 expect(board().getAttribute('data-preview-progress')).toBe('1');
});
it('stops on page hiding and does not spend animation time in the background',()=>{
 render(createElement(AxiomPublicHero));notify();advance(1200);hidden=true;act(()=>document.dispatchEvent(new Event('visibilitychange')));
 const progress=board().getAttribute('data-preview-progress');advance(6000);expect(board().getAttribute('data-preview-progress')).toBe(progress);
 hidden=false;act(()=>document.dispatchEvent(new Event('visibilitychange')));advance(4000);expect(board().getAttribute('data-preview-progress')).toBe('1');
});
it('keeps reduced-motion and unsupported observers fully static and readable',()=>{
 reduced=true;render(createElement(AxiomPublicHero));expect(board().getAttribute('data-preview-progress')).toBe('1');expect(intervals).not.toHaveBeenCalled();
 cleanup();reduced=false;vi.stubGlobal('IntersectionObserver',undefined);render(createElement(AxiomPublicHero));
 expect(board().getAttribute('data-preview-progress')).toBe('1');expect(intervals).not.toHaveBeenCalled();
});
it('settles immediately if reduced motion is requested during the reveal',()=>{
 render(createElement(AxiomPublicHero));notify();advance(600);reduced=true;act(()=>mediaListeners.forEach(fn=>fn()));
 expect(board().getAttribute('data-preview-progress')).toBe('1');expect(vi.getTimerCount()).toBe(0);reduced=false;act(()=>mediaListeners.forEach(fn=>fn()));
 expect(board().getAttribute('data-preview-active')).toBe('false');
});
it('cleans the clock/listeners/observer and ignores late callbacks after unmount',()=>{
 const view=render(createElement(AxiomPublicHero));notify();view.unmount();expect(vi.getTimerCount()).toBe(0);expect(mediaListeners.size).toBe(0);expect(observers[0].disconnect).toHaveBeenCalled();
 notify();expect(vi.getTimerCount()).toBe(0);
});

it('keeps the decorative integration rows finite, hidden from assistive navigation, and inert',()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);render(createElement(IntegrationConnectionsScene,{entries:publicCatalogEntries()}));
 const scene=document.querySelector('.integration-connections-scene')!;
 expect(scene.getAttribute('aria-hidden')).toBe('true');expect(scene.querySelector('a,button,input')).toBeNull();notify();advance(2400);
 expect(scene.getAttribute('data-preview-active')).toBe('true');advance(2600);expect(scene.getAttribute('data-preview-active')).toBe('false');
 expect(vi.getTimerCount()).toBe(0);expect(fetch).not.toHaveBeenCalled();
});
it('retains static integration logos without an animation clock for reduced motion',()=>{
 reduced=true;render(createElement(IntegrationConnectionsScene,{entries:publicCatalogEntries()}));
 expect(document.querySelectorAll('.integration-logo-tile')).toHaveLength(publicCatalogEntries().length);
 expect(intervals).not.toHaveBeenCalled();expect(document.querySelector('.integration-connections-scene')?.getAttribute('data-preview-active')).toBe('false');
});
