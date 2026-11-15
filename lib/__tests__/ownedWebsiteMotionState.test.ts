import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {expect,it} from 'vitest';
const source=readFileSync('scripts/capture-owned-website.mjs','utf8');
function fixture(){
 let shown='const timeoutMs',full='const timeoutMs = 8_000;\nmaxAttempts: 3',title='Make a small, reviewable edit.',step='Step 2: Make a small, reviewable edit.';
 const pre={get innerText(){return full+shown+'▍'},get textContent(){return full+shown+'▍'},querySelector:(selector:string)=>selector==='.sr-only'?{get textContent(){return full}}:selector==='[aria-hidden="true"]'?{get childNodes(){return [{nodeType:3,textContent:shown},{nodeType:1,textContent:'▍'}]}}:null};
 const document={querySelector:(selector:string)=>selector==='#product-tour h2'?{textContent:title}:selector==='#product-tour pre'?pre:selector==='#product-tour [aria-current="step"]'?{getAttribute:()=>step}:null};
 const helperStart=source.indexOf('function readWorkflowStoryState()');
 const helpers=helperStart<0?'':source.slice(helperStart,source.indexOf('function isHomepageManualReady()',helperStart));
 const start=source.indexOf('  const state = () =>');const end=source.indexOf("  await send('Page.enable')",start);
 const read=vm.compileFunction(`${helpers}\n${source.slice(start,end)}\nreturn state;`,['evaluate'])(async(fn:unknown)=>vm.compileFunction(`return (${String(fn)})();`,['document'])(document));
 return {read,paint:()=>vm.compileFunction(`${helpers};return readWorkflowPaintState();`,['document'])(document),advance:()=>{shown='const timeoutMs = 8_000;\nmaxAttempts: 3'},change:()=>{full='changed source';title='Changed step';step='Step 3: Changed step'}};
}
it('does not mistake finite typed painting for a manual workflow state change',async()=>{
 const f=fixture();const before=await f.read();f.advance();expect(await f.read()).toEqual(before);expect(before.code).toBe('const timeoutMs = 8_000;\nmaxAttempts: 3');
});
it('still detects a real selected-step or source change',async()=>{
 const f=fixture();const before=await f.read();f.change();const after=await f.read();expect(after).not.toEqual(before);expect(after.title).toBe('Changed step');expect(after.code).toBe('changed source');
});
it('observes the displayed prefix separately so offscreen and hidden painting can be checked',()=>{
 const f=fixture();const before=f.paint();f.advance();const after=f.paint();expect(before.source).toBe(after.source);expect(before.shown).not.toBe(after.shown);expect(after.shown).toBe(after.source);expect(after.shown).not.toContain('▍');
});
