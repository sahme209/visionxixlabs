import {expect,it} from 'vitest';
import {deriveAssembly, projectPoint, ASSEMBLY_STAGES} from '../governanceAssemblyModel';
it('bounds invalid stage and camera input without corrupting any geometry',()=>{
 for(const selected of [-50,Infinity,NaN,99]){
  const state=deriveAssembly({selected,camera:Infinity,view:'inspect'});
  expect(state.selected).toBeGreaterThanOrEqual(0);expect(state.selected).toBeLessThan(5);
  for(const plate of state.plates)expect(Object.values(plate).filter(x=>typeof x==='number').every(Number.isFinite)).toBe(true);
 }
 expect(projectPoint([0,0,0],NaN).every(Number.isFinite)).toBe(true);
});
it('one selection determines the highlighted plate and the explanatory record',()=>{
 for(let selected=0;selected<5;selected++){
  const state=deriveAssembly({selected,camera:0,view:'assembled'});
  expect(state.plates.filter(p=>p.active).map(p=>p.index)).toEqual([selected]);
  expect(state.record).toBe(ASSEMBLY_STAGES[selected]);
 }
});
it('inspection separates records without conflating review and requester or inventing outcomes',()=>{
 const a=deriveAssembly({selected:2,camera:0,view:'assembled'}),b=deriveAssembly({selected:2,camera:0,view:'inspect'});
 expect(b.plates[4].z-b.plates[0].z).toBeGreaterThan(a.plates[4].z-a.plates[0].z);
 expect(ASSEMBLY_STAGES[2].title).toBe('Independent review');
 expect(ASSEMBLY_STAGES[3].title).toBe('Separate requester execution');
 expect(ASSEMBLY_STAGES[4].boundary).toContain('Unknown remains unresolved');
 expect(deriveAssembly({selected:2,camera:999,view:'inspect'}).camera).toBe(16);
});
it('paints an extracted selected record above every other layer, including the lowest repository plate',()=>{
 for(let selected=0;selected<5;selected++){
  const state=deriveAssembly({selected,camera:0,view:'inspect'});
  const active=state.plates.find(p=>p.active)!;
  expect(active.z).toBeGreaterThan(Math.max(...state.plates.filter(p=>!p.active).map(p=>p.z))+20);
  expect(state.paintOrder.at(-1)).toBe(selected);
  for(const camera of [-16,16])for(const dx of [-75,75])for(const dy of [-45,45]){
   const [x,y]=projectPoint([active.x+dx,active.y+dy,active.z],camera);
   expect(x).toBeGreaterThan(0);expect(x).toBeLessThan(640);expect(y).toBeGreaterThan(0);expect(y).toBeLessThan(470);
  }
 }
});
