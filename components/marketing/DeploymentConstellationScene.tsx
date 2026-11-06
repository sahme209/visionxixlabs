import {linePath,platePath,projectPoint,type WorldPoint,type DeploymentObjectId,deriveAssembly} from './governanceAssemblyModel';
import styles from './GovernanceAssembly.module.css';
type Model=ReturnType<typeof deriveAssembly>;
function face(points:WorldPoint[],camera:number){return linePath(points,camera)+' Z'}
function Solid({x,y,w,d,h,z=0,camera,fill}:{x:number;y:number;w:number;d:number;h:number;z?:number;camera:number;fill:string}){
 const x0=x-w/2,x1=x+w/2,y0=y-d/2,y1=y+d/2;
 return <g><path className={styles.solidLeft} d={face([[x0,y1,z],[x1,y1,z],[x1,y1,z+h],[x0,y1,z+h]],camera)}/><path className={styles.solidRight} d={face([[x1,y0,z],[x1,y1,z],[x1,y1,z+h],[x1,y0,z+h]],camera)}/><path className={styles.solidTop} style={{fill}} d={platePath(x0,y0,w,d,z+h,camera,2)}/></g>;
}
/** Seven original deployment objects. No provider/account state is represented. */
export function DeploymentConstellationScene({model,prefix,onHover,onLeave}:{model:Model;prefix:string;onHover:(id:DeploymentObjectId)=>void;onLeave:()=>void}){
 const camera=model.camera,fill=`url(#${prefix}-matte)`;
 const routes:[string,string][]=[['repository','artifact'],['artifact','gate'],['gate','services'],['services','staging'],['staging','production'],['staging','evidence']];
 return <>
 <defs><linearGradient id={`${prefix}-matte`} x2=".7" y2="1"><stop stopColor="var(--face-light)"/><stop offset="1" stopColor="var(--face-dark)"/></linearGradient><linearGradient id={`${prefix}-floor`} x2="1" y2="1"><stop stopColor="var(--base-light)"/><stop offset="1" stopColor="var(--base-dark)"/></linearGradient></defs>
 <g aria-hidden="true">
  <Solid x={0} y={10} w={290} d={244} h={6} z={-8} camera={camera} fill={`url(#${prefix}-floor)`}/>
  {routes.map(([from,to])=>{const a=model.objects.find(o=>o.id===from)!,b=model.objects.find(o=>o.id===to)!;const active=a.active||b.active;const mid:WorldPoint=[b.x,a.y,0];const points:WorldPoint[]=[[a.x,a.y,0],mid,[b.x,b.y,0]];return <g key={to} className={`${styles.route} ${active?styles.routeActive:''}`} data-route={to} data-held={to==='production'?'true':undefined}>{to==='production'?<><path d={linePath([[a.x,a.y,0],[a.x,a.y+29,0]],camera)}/><path d={linePath([[b.x,b.y-12,0],[b.x,b.y,0]],camera)}/></>:<path d={linePath(points,camera)}/>}</g>})}
  {model.paintOrder.map(id=>{const o=model.objects.find(item=>item.id===id)!,z=o.lift;const solid=(x:number=o.x,y:number=o.y,w:number=o.w,d:number=o.d,h:number=o.h,bottom:number=z)=><Solid x={x} y={y} w={w} d={d} h={h} z={bottom} camera={camera} fill={fill}/>;const line=(points:WorldPoint[])=>linePath(points,camera);return <g key={id} className={`${styles.deploymentObject} ${o.active?styles.active:''}`} data-object={id}>
   {id==='repository'&&<>{solid()}<g className={styles.objectDetail}><path d={line([[o.x-16,o.y+17,z+9],[o.x+15,o.y+17,z+9]])}/><path d={line([[o.x-16,o.y+17,z+18],[o.x+15,o.y+17,z+18]])}/><path d={line([[o.x-12,o.y,z+35],[o.x,o.y,z+35],[o.x+11,o.y-9,z+35]])}/><path d={line([[o.x,o.y,z+35],[o.x+11,o.y+9,z+35]])}/>{[[-12,0],[11,-9],[11,9]].map(([x,y])=>{const p=projectPoint([o.x+x,o.y+y,z+35],camera);return <circle key={`${x}:${y}`} cx={p[0]} cy={p[1]} r={2.8}/>})}</g></>}
   {id==='artifact'&&<>{solid()}<g className={styles.objectDetail}><path d={line([[o.x-19,o.y,z+37],[o.x+19,o.y,z+37]])}/><path d={line([[o.x,o.y-19,z+37],[o.x,o.y+19,z+37],[o.x,o.y+19,z+7]])}/></g><Solid x={o.x+3} y={o.y-3} w={13} d={10} h={3} z={z+37} camera={camera} fill={fill}/></>}
   {id==='gate'&&<>{solid(o.x-20,o.y,8,20,46)}{solid(o.x+20,o.y,8,20,46)}{solid(o.x,o.y,48,20,8,z+(o.active?58:46))}<g className={styles.objectDetail}><path d={line([[o.x-10,o.y,z+6],[o.x-10,o.y,z+38],[o.x-3,o.y,z+38],[o.x-3,o.y,z+6]])}/><path d={line([[o.x+3,o.y,z+6],[o.x+3,o.y,z+31],[o.x+10,o.y,z+31],[o.x+10,o.y,z+6]])}/></g></>}
   {id==='services'&&<>{[-15,0,15].map((dx,i)=><g key={dx}>{solid(o.x+dx,o.y,11,28,24+i*5)}<g className={styles.objectDetail}>{[8,15].map(h=><path key={h} d={line([[o.x+dx-4,o.y+14,z+h],[o.x+dx+4,o.y+14,z+h]])}/>)}</g></g>)}</>}
   {(id==='staging'||id==='production')&&<>{solid(o.x,o.y,46,38,7)}{solid(o.x,o.y,24,20,id==='production'?23:18,z+7)}<path className={styles.targetRing} d={platePath(o.x-28,o.y-23,56,46,z+1,camera,4)}/>{id==='production'&&<g className={styles.heldBarrier}>{solid(o.x-14,o.y-23,4,5,15,0)}{solid(o.x+14,o.y-23,4,5,15,0)}<path d={line([[o.x-14,o.y-23,14],[o.x+14,o.y-23,14]])}/></g>}</>}
   {id==='evidence'&&<>{solid(o.x,o.y,48,32,7)}{solid(o.x,o.y,42,27,2,z+9)}<g className={styles.objectDetail}>{[-8,0,8].map(dy=><path key={dy} d={line([[o.x-15,o.y+dy,z+12],[o.x+15,o.y+dy,z+12]])}/>)}</g>{o.active&&solid(o.x-8,o.y-4,42,27,2,z+24)}</>}
  </g>})}
  {model.objects.map(o=>{const points=[[-o.w/2,-o.d/2,0],[o.w/2,o.d/2,o.h],[-o.w/2,o.d/2,o.h],[o.w/2,-o.d/2,0]].map(([x,y,z])=>projectPoint([o.x+x,o.y+y,z],camera));const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);return <rect key={`hit-${o.id}`} data-hit-target={o.id} className={styles.objectHit} x={Math.min(...xs)} y={Math.min(...ys)} width={Math.max(...xs)-Math.min(...xs)} height={Math.max(...ys)-Math.min(...ys)} onPointerEnter={event=>{if(event.pointerType!=='touch')onHover(o.id)}} onPointerLeave={onLeave}/>})}
 </g>
 </>;
}
