import {expect,it} from 'vitest';
import {deriveAssembly,projectPoint,ASSEMBLY_STAGES,DEPLOYMENT_OBJECTS} from '../governanceAssemblyModel';
it('bounds invalid stages/cameras while keeping seven original deployment objects finite',()=>{
 for(const selected of [-50,Infinity,NaN,99]){
  const state=deriveAssembly({selected,camera:Infinity,view:'inspect'});
  expect(state.selected).toBeGreaterThanOrEqual(0);expect(state.selected).toBeLessThan(5);expect(state.objects).toHaveLength(7);
  for(const object of state.objects)expect(Object.values(object).filter(x=>typeof x==='number').every(Number.isFinite)).toBe(true);
 }
 expect(projectPoint([0,0,0],NaN).every(Number.isFinite)).toBe(true);
});
it('maps every deployment object to the same truthful stage record, keeping production held',()=>{
 for(const object of DEPLOYMENT_OBJECTS){
  const state=deriveAssembly({selected:0,objectId:object.id,camera:0,view:'inspect'});
  expect(state.record).toBe(ASSEMBLY_STAGES[object.stage]);expect(state.objects.filter(o=>o.active).map(o=>o.id)).toEqual([object.id]);
 }
 expect(DEPLOYMENT_OBJECTS.find(o=>o.id==='production')!.detail).toContain('broken route does not run or authorize');
 expect(ASSEMBLY_STAGES[2].title).toBe('Independent review');expect(ASSEMBLY_STAGES[3].title).toBe('Separate requester execution');expect(ASSEMBLY_STAGES[4].boundary).toContain('Unknown remains unresolved');
});
it('inspection lifts an object while its logical hit geometry remains stable',()=>{
 const rest=deriveAssembly({selected:1,camera:0,view:'assembled'}),inspect=deriveAssembly({selected:1,camera:0,view:'inspect'});
 expect(inspect.objects.find(o=>o.active)!.lift).toBeGreaterThan(rest.objects.find(o=>o.active)!.lift);
 expect(inspect.objects.map(o=>[o.id,o.x,o.y,o.w,o.d,o.h])).toEqual(rest.objects.map(o=>[o.id,o.x,o.y,o.w,o.d,o.h]));
});
it('keeps all object corner poses inside the scene at both camera limits',()=>{
 for(const object of DEPLOYMENT_OBJECTS)for(const camera of [-16,16])for(const dx of [-object.w/2,object.w/2])for(const dy of [-object.d/2,object.d/2])for(const z of [0,object.h+24]){
  const [x,y]=projectPoint([object.x+dx,object.y+dy,z],camera);expect(x).toBeGreaterThan(0);expect(x).toBeLessThan(640);expect(y).toBeGreaterThan(0);expect(y).toBeLessThan(470);
 }
});
