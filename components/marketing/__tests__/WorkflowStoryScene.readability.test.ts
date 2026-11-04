/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {WorkflowStoryScene} from '../WorkflowStoryScene';
import type {StoryScene} from '../workflowStories';
afterEach(cleanup);
const context={repository:'sample/repository',branch:'sample-branch',environment:'Test'};
const evidence=['Configuration preview · illustrative','Trusted customer plan producer unavailable','Current target authority unavailable','Terraform apply disabled'];
const receipt=['A sample decision is not proof of execution','GitHub write not performed','AWS ECS health not observed','Recovery evidence not verified'];
const states=[{name:'initial',fraction:0,active:true,reducedMotion:false},{name:'partial',fraction:0.2,active:true,reducedMotion:false},{name:'paused partial',fraction:0.01,active:false,reducedMotion:false},{name:'reduced motion',fraction:0,active:false,reducedMotion:true}];
it.each((['evidence','hold','receipt'] as const).flatMap(scene=>states.map(state=>({scene,...state}))))('keeps all $scene essential text fully opaque at $name progress',({scene,fraction,active,reducedMotion})=>{
 const view=render(createElement(WorkflowStoryScene,{scene:scene as StoryScene,context,fraction,active,reducedMotion,decision:null,onDecision:()=>{throw Error('No decision expected')}}));
 const texts=scene==='receipt'?receipt:evidence;
 for(const text of texts){
  const node=screen.getByText(text);expect(node.textContent).toBe(text);
  // Check the text and every rendered ancestor, rather than an implementation
  // selector, so moving opacity to another essential-text wrapper still fails.
  for(let ancestor:HTMLElement|null=node;ancestor&&ancestor!==view.container;ancestor=ancestor.parentElement){
   const opacity=getComputedStyle(ancestor).opacity;
   expect(opacity===''||Number(opacity)===1,`Essential text dimmed: ${text}`).toBe(true);
   expect(ancestor.getAttribute('aria-hidden')).not.toBe('true');
  }
 }
 expect(screen.getByText('Cloud end-to-end acceptance is unverified.')).toBeTruthy();
 // Any deliberately dimmed descendants must be nonessential decorations.
 for(const element of view.container.querySelectorAll<HTMLElement>('[style]')){
  const opacity=element.style.opacity;if(opacity!==''&&Number(opacity)<1){expect(element.getAttribute('aria-hidden')).toBe('true');expect(element.textContent).toBe('');}
 }
});
