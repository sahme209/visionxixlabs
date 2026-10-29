import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {it,expect,vi} from 'vitest';
const source=readFileSync(new URL('../../scripts/capture-owned-website.mjs',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('async function settleControlPointer('),source.indexOf('// Observation only:'));
const settle=vm.compileFunction(`${helper};return settleControlPointer(read,move,frame);`,['read','move','frame']);
it('remeasures the shifted documentation link before committing to its final location',async()=>{const old={x:194.03,y:539.72},next={x:214.03,y:687.72};let reads=0;const move=vi.fn(async(_point:{x:number;y:number})=>{});const point=await settle(async()=>++reads===1?old:next,move,async()=>{});expect(point).toEqual(next);expect(move.mock.calls.at(-1)?.[0]).toEqual(next)});
it('refuses a continuously moving target instead of returning stale coordinates',async()=>{let x=0;await expect(settle(async()=>({x:x++,y:50}),async()=>{},async()=>{})).rejects.toThrow('control_geometry_unstable');expect(x).toBeLessThan(20)});
it('does not accept invalid numeric geometry as stable',async()=>{await expect(settle(async()=>({x:NaN,y:50}),async()=>{},async()=>{})).rejects.toThrow('control_geometry_unstable')});
