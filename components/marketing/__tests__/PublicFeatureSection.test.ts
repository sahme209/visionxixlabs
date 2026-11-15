// @vitest-environment jsdom
import {createElement} from 'react';
import {act,cleanup,fireEvent,render} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PublicFeatureSection} from '../PublicFeatureSection';
let matches=true,height=400,tops=[128,350,800],queued:FrameRequestCallback|undefined,changes:Set<()=>void>;
beforeEach(()=>{
 matches=true;height=400;tops=[128,350,800];changes=new Set();queued=undefined;
 Object.defineProperty(window,'innerHeight',{configurable:true,value:900});
 vi.stubGlobal('matchMedia',()=>({get matches(){return matches},addEventListener:(_:string,fn:()=>void)=>changes.add(fn),removeEventListener:(_:string,fn:()=>void)=>changes.delete(fn)}));
 vi.stubGlobal('requestAnimationFrame',vi.fn((fn:FrameRequestCallback)=>{queued=fn;return 7}));vi.stubGlobal('cancelAnimationFrame',vi.fn());
 vi.spyOn(HTMLElement.prototype,'offsetHeight','get').mockImplementation(()=>height);
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){const top=tops[Number(this.dataset.panel)]||0;return {x:0,y:top,top,bottom:top+height,left:0,right:1000,width:1000,height,toJSON(){return {}}}});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
function flush(){const fn=queued;queued=undefined;act(()=>fn?.(0));}
function mount(){return render(createElement(PublicFeatureSection,{labelledBy:'heading',children:[0,1,2].map(i=>createElement('article',{key:i,'data-panel':i,className:'public-feature-panel'},'Panel '+i))}));}
it('links restrained card depth to scroll and coalesces scroll events without an idle loop',()=>{
 const view=mount();flush();const root=view.container.querySelector('section')!,panels=root.querySelectorAll<HTMLElement>('article');
 expect(root.dataset.stackReady).toBe('true');
 expect(Number(panels[0].style.getPropertyValue('--feature-scale'))).toBeLessThan(1);
 expect(Number(panels[0].style.getPropertyValue('--feature-scale'))).toBeGreaterThanOrEqual(.96);
 expect(queued).toBeUndefined();
 fireEvent.scroll(window);fireEvent.scroll(window);expect(queued).toBeDefined();
 tops=[128,128,128];flush();
 expect(Number(panels[0].style.getPropertyValue('--feature-scale'))).toBe(.96);
 expect(panels[2].style.getPropertyValue('--feature-scale')).toBe('1');expect(queued).toBeUndefined();
});
it('keeps normal flow for oversized content, phone sizes or reduced-motion preferences',()=>{
 height=850;const view=mount();flush();const root=view.container.querySelector('section')!;
 expect(root.dataset.stackReady).toBe('false');
 height=400;matches=false;act(()=>{for(const changed of changes)changed()});flush();
 expect(root.dataset.stackReady).toBe('false');
 expect(root.querySelector<HTMLElement>('article')!.style.getPropertyValue('--feature-scale')).toBe('1');
});
it('releases its pending frame and listeners on unmount',()=>{
 const view=mount();expect(changes.size).toBe(1);view.unmount();
 expect(cancelAnimationFrame).toHaveBeenCalledWith(7);expect(changes.size).toBe(0);
 const calls=vi.mocked(requestAnimationFrame).mock.calls.length;
 fireEvent.scroll(window);expect(vi.mocked(requestAnimationFrame).mock.calls).toHaveLength(calls);
});
