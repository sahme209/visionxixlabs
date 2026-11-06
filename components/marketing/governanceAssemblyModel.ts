/** Original scene model. Conceptual records only: no operational state or authority. */
export const ASSEMBLY_STAGES = [
 {number:'01',title:'Repository context',record:'Scope record',fields:'Repository / branch / environment',detail:'Start with the repository, branch, environment, and requested outcome so the work has a clear scope.',boundary:'Context gives a proposal its boundaries. It does not grant permission to act.'},
 {number:'02',title:'Exact proposal',record:'Proposal record',fields:'Change / expected effect / validation',detail:'Inspect the specific change, its expected effect, the validation plan, and recovery context before making a decision.',boundary:'Review is meaningful only when it refers to the specific proposed change.'},
 {number:'03',title:'Independent review',record:'Review record',fields:'Exact proposal / authorized reviewer',detail:'Where supported, an authorized reviewer assesses the exact proposal separately from the requester.',boundary:'A review belongs to the exact proposal. It is not a request to execute.'},
 {number:'04',title:'Separate requester execution',record:'Intent record',fields:'Requester / deliberate execution request',detail:'Where supported, the requester deliberately asks to execute after review. Approval and execution are separate steps.',boundary:'Requester intent is a separate step after review, where the workflow supports it.'},
 {number:'05',title:'Recorded outcome and recovery',record:'Outcome record',fields:'Recorded result / evidence / recovery',detail:'Inspect the recorded result and available evidence. Keep refused or unknown outcomes visible alongside recovery context; a plan is not proof of recovery.',boundary:'Confirmed requires recorded evidence. Refused means the action was declined. Unknown remains unresolved; a recovery plan does not confirm recovery.'},
] as const;
export type AssemblyView='assembled'|'inspect';
export const DEPLOYMENT_OBJECTS = [
 {id:'repository',label:'Repository',stage:0,x:-110,y:-45,w:42,d:32,h:34,detail:'A branch and its repository context define the proposed deployment scope.'},
 {id:'artifact',label:'Build artifact',stage:1,x:-46,y:-65,w:38,d:38,h:36,detail:'Inspect the exact package and proposed revision, not a generic success badge.'},
 {id:'gate',label:'Review gate',stage:2,x:12,y:-15,w:48,d:20,h:54,detail:'Review and requester intent are separate mechanisms. Inspecting this gate grants no authority.'},
 {id:'services',label:'Services',stage:3,x:78,y:-62,w:46,d:32,h:34,detail:'Service objects illustrate a topology; they do not mean any account is connected.'},
 {id:'staging',label:'Staging target',stage:3,x:78,y:16,w:46,d:38,h:25,detail:'Inspect the intended environment and prerequisites before any separately authorized action.'},
 {id:'production',label:'Production · held',stage:3,x:76,y:91,w:46,d:38,h:30,detail:'Production is held in this conceptual scene. The broken route does not run or authorize a deployment.'},
 {id:'evidence',label:'Evidence record',stage:4,x:-25,y:76,w:48,d:32,h:23,detail:'Inspect recorded evidence. Confirmed, refused and unknown remain distinct possible outcomes.'},
] as const;
export type DeploymentObjectId=typeof DEPLOYMENT_OBJECTS[number]['id'];
export const PRIMARY_OBJECTS:DeploymentObjectId[]=['repository','artifact','gate','staging','evidence'];
export interface AssemblyInput {selected:number;view:AssemblyView;camera:number;objectId?:DeploymentObjectId}
export type WorldPoint=readonly[number,number,number];
const bound=(n:number,lo:number,hi:number)=>Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):0;
export function deriveAssembly(input:AssemblyInput){
 const requestedStage=Math.round(bound(input.selected,0,4)),camera=bound(input.camera,-16,16),view=input.view==='inspect'?'inspect':'assembled';
 const object=DEPLOYMENT_OBJECTS.find(o=>o.id===input.objectId)??DEPLOYMENT_OBJECTS.find(o=>o.id===PRIMARY_OBJECTS[requestedStage])!;
 const selected=object.stage;
 const objects=DEPLOYMENT_OBJECTS.map(o=>({...o,active:o.id===object.id,lift:o.id===object.id&&view==='inspect'?12:0}));
 const paintOrder=[...objects].sort((a,b)=>(a.x+a.y)-(b.x+b.y)).map(o=>o.id);
 return {selected,camera,view,record:ASSEMBLY_STAGES[selected],object,objects,paintOrder};
}
export function projectPoint([x,y,z]:WorldPoint,camera:number):[number,number]{
 const angle=(45+bound(camera,-16,16))*Math.PI/180;
 return [320+(x*Math.cos(angle)-y*Math.sin(angle))*1.55,300+(x*Math.sin(angle)+y*Math.cos(angle))*.68-z*1.2];
}
/** Standard rounded rectangle sampling, projected from original world-space geometry. */
export function platePath(x:number,y:number,width:number,height:number,z:number,camera:number,radius=7):string{
 const points:WorldPoint[]=[];const centers=[[x+width-radius,y+radius,-90],[x+width-radius,y+height-radius,0],[x+radius,y+height-radius,90],[x+radius,y+radius,180]];
 for(const [cx,cy,start] of centers)for(let step=0;step<=5;step++){const angle=(start+step*18)*Math.PI/180;points.push([cx+radius*Math.cos(angle),cy+radius*Math.sin(angle),z]);}
 return points.map((point,index)=>`${index?'L':'M'}${projectPoint(point,camera).map(n=>n.toFixed(2)).join(',')}`).join(' ')+' Z';
}
export function linePath(points:WorldPoint[],camera:number):string{return points.map((p,i)=>`${i?'L':'M'}${projectPoint(p,camera).map(n=>n.toFixed(2)).join(',')}`).join(' ')}
