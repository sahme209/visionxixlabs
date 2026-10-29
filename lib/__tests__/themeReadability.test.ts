import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
const css=readFileSync(new URL('../../desktop/src/styles.css',import.meta.url),'utf8');
function luminance(hex:string){const v=hex.match(/\w\w/g)!.map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;}
it.each(['violet','orange'])('keeps light-theme selected %s labels readable on a light surface',(family)=>{
 const rule=css.split('}').find(rule=>rule.includes('html[data-theme="light"]')&&rule.includes('.text-'+family+'-200'));
 expect(rule,'native selected-state text needs an explicit readable light color').toBeTruthy();
 const hex=rule!.match(/color:\s*#([0-9a-f]{6})/i)![1];
 expect((luminance('f1f2f5')+.05)/(luminance(hex)+.05)).toBeGreaterThanOrEqual(4.5);
});
