"use client";

import {useEffect,useId,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';
import {ASSEMBLY_STAGES,deriveAssembly,linePath,platePath,type AssemblyView,type WorldPoint} from './governanceAssemblyModel';
import styles from './GovernanceAssembly.module.css';

/** Original SVG geometry; Hairline construction/Teardown inspection adapted, no upstream runtime. */
function RecordFeatures({index,x,y,z,camera}:{index:number;x:number;y:number;z:number;camera:number}){
 const line=(points:WorldPoint[])=>linePath(points,camera);
 const rule=(a:number,b:number,c:number,d:number)=>line([[x+a,y+b,z],[x+c,y+d,z]]);
 const box=(a:number,b:number,w:number,h:number)=>platePath(x+a,y+b,w,h,z,camera,2);
 if(index===0)return <g className={styles.detail}>
  {[0,1,2].map(i=><path key={i} d={box(-51+i*28,-24,21,44)}/>)}
  {[0,1,2].map(i=><path key={i} d={rule(-47+i*28,-12,-35+i*28,-12)}/>)}
  <path d={rule(-52,30,52,30)}/><path d={rule(-52,34,28,34)}/>
 </g>;
 if(index===1)return <g className={styles.detail}>
  <path d={box(-53,-28,106,56)}/>
  {[-16,-5,6,17].map((v,i)=><path key={v} d={rule(-41,v,i===1?2:41,v)}/>)}
  <path d={rule(15,-9,15,-1)}/><path d={rule(11,-5,19,-5)}/>
 </g>;
 if(index===2)return <g className={styles.detail}>
  <path d={box(-53,-28,48,56)}/><path d={box(5,-28,48,56)}/>
  {[-14,-2,10].flatMap(v=>[-1,1].map(side=><path key={`${v}:${side}`} d={rule(side<0?-43:15,v,side<0?-15:43,v)}/>))}
  <path d={rule(0,-34,0,34)}/>
 </g>;
 if(index===3)return <g className={styles.detail}>
  <path d={box(-52,-26,104,52)}/><path d={box(-39,-13,46,26)}/>
  <path d={rule(19,-21,19,21)}/><path d={rule(26,-21,26,21)}/>
  <path d={box(14,-4,22,8)}/>
 </g>;
 return <g className={styles.detail}>
  {[-24,-3,18].map(v=><g key={v}><path d={box(-52,v,104,14)}/><path d={rule(-36,v+7,38,v+7)}/></g>)}
 </g>;
}

export function GovernanceAssembly({compact=false}:{compact?:boolean}){
 const prefix=useId(),panelId=`${prefix}-record`,sceneId=`${prefix}-scene`,helpId=`${prefix}-help`;
 const [selected,setSelected]=useState(0),[view,setView]=useState<AssemblyView>('assembled'),[camera,setCamera]=useState(0),[reduced,setReduced]=useState(false);
 const controls=useRef<(HTMLButtonElement|null)[]>([]);
 useEffect(()=>{const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');if(!media)return;const update=()=>setReduced(media.matches);update();media.addEventListener?.('change',update);return()=>media.removeEventListener?.('change',update)},[]);
 const model=deriveAssembly({selected,view,camera});
 function navigate(event:KeyboardEvent<HTMLButtonElement>,index:number){
  if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.nativeEvent.isComposing||event.nativeEvent.keyCode===229)return;
  const key=event.key;const next=key==='Home'?0:key==='End'?4:key==='ArrowRight'||key==='ArrowDown'?(index+1)%5:key==='ArrowLeft'||key==='ArrowUp'?(index+4)%5:null;
  if(next===null)return;event.preventDefault();setSelected(next);controls.current[next]?.focus();
 }
 function orbit(event:PointerEvent<HTMLDivElement>){
  if(reduced||event.pointerType!=='mouse'||!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches)return;
  const rect=event.currentTarget.getBoundingClientRect();if(rect.width<=0)return;
  // Fixed stage bounds affect only ornamental camera orientation, never stage selection.
  setCamera(Math.max(-8,Math.min(8,((event.clientX-rect.left)/rect.width-.5)*16)));
 }
 return <section className={`${styles.assembly} ${compact?styles.compact:''}`} aria-label="Explore the evidence assembly">
  <div className={styles.intro}><p className={styles.eyebrow}>Inside a governed decision</p><p className={styles.instruction}>Five records. Distinct responsibilities.</p></div>
  <p id={helpId} className={styles.caption}>Conceptual illustration · local explanation only. Choose a stage to inspect its record; no actions are performed.</p>
  <noscript><div className={styles.staticReading}>
   <h3>Read the complete workflow</h3><p>Interactive controls require JavaScript. All five conceptual records and their limits are available below.</p>
   <ol>{ASSEMBLY_STAGES.map(stage=><li key={stage.number}><h4>{stage.number} · {stage.title}</h4><p>{stage.detail}</p><p>{stage.boundary}</p></li>)}</ol>
  </div></noscript>
  <ol aria-label="Conceptual workflow" aria-describedby={helpId} className={styles.stages}>
   {ASSEMBLY_STAGES.map((stage,index)=><li key={stage.number}><h3><button id={`${prefix}-stage-${index+1}`} ref={node=>{controls.current[index]=node}} type="button" aria-pressed={selected===index} aria-controls={panelId} onClick={()=>setSelected(index)} onKeyDown={event=>navigate(event,index)}><span className={styles.number} aria-hidden="true">{stage.number}</span><span>{stage.title}</span></button></h3></li>)}
  </ol>
  <div className={styles.workspace}>
   <div className={styles.visual} onPointerMove={orbit} onPointerLeave={()=>setCamera(0)}>
    <svg id={sceneId} className={styles.scene} viewBox="0 0 640 470" role="img" aria-label={`Evidence assembly — ${model.record.title}. Conceptual records, not execution status.`} data-selected-stage={model.selected} data-view={model.view}>
     <title>One folio, five separate records</title><desc>Layered repository, proposal, review, requester intent and outcome records. Inspect separates the layers. Stage buttons provide the same explanation without interpreting the drawing.</desc>
     <g aria-hidden="true">
      <path className={styles.baseSide} d={platePath(-97,-66,194,132,-7,camera,11)}/><path className={styles.base} d={platePath(-97,-66,194,132,0,camera,11)}/>
      <path className={styles.guide} d={linePath([[-76,-45,5],[-76,-45,153]],camera)}/><path className={styles.guide} d={linePath([[76,45,5],[76,45,153]],camera)}/>
      {model.plates.map(plate=><g key={plate.index} className={`${styles.plate} ${plate.active?styles.active:''}`}>
       <path className={styles.plateSide} d={platePath(-75+plate.x,-45+plate.y,150,90,plate.z-5,camera,8)}/>
       <path className={styles.plateFace} d={platePath(-75+plate.x,-45+plate.y,150,90,plate.z,camera,8)}/>
       <path className={styles.crease} d={platePath(-70+plate.x,-40+plate.y,140,80,plate.z+.1,camera,5)}/>
       <RecordFeatures index={plate.index} x={plate.x} y={plate.y} z={plate.z+.3} camera={camera}/>
       <path className={styles.tab} d={platePath(-63+plate.x+plate.index*24,45+plate.y,17,8,plate.z,camera,2)}/>
      </g>)}
      <path className={styles.baseMark} d={linePath([[-56,72,0],[-23,72,0]],camera)}/>
     </g>
    </svg>
    <div className={styles.sceneMeta} aria-hidden="true"><span>Evidence assembly / {model.record.number}</span><span>{view==='inspect'?'Separated layers':'Resting assembly'}</span></div>
   </div>
   <div id={panelId} role="region" aria-labelledby={`${prefix}-stage-${selected+1}`} className={styles.record}>
    <p className={styles.recordKicker}>Record {model.record.number} / concept</p>
    <p className={styles.recordTitle}>{model.record.record}</p><p className={styles.fields}>{model.record.fields}</p>
    <p className={styles.detailText}>{model.record.detail}</p><p className={styles.boundary}>{model.record.boundary}</p>
    <div className={styles.viewControls} aria-label="Assembly view">
     <button type="button" aria-pressed={view==='inspect'} aria-controls={sceneId} onClick={()=>setView('inspect')}>Inspect layers</button>
     <button type="button" aria-pressed={view==='assembled'} aria-controls={sceneId} onClick={()=>setView('assembled')}>Assemble layers</button>
    </div>
    <div className={styles.cameraControls} aria-label="Camera view">
     <button type="button" aria-label="Camera left" aria-controls={sceneId} onClick={()=>setCamera(value=>Math.max(-16,value-8))}>↶ <span>Left</span></button>
     <button type="button" aria-label="Reset camera" aria-controls={sceneId} onClick={()=>setCamera(0)}>Reset view</button>
     <button type="button" aria-label="Camera right" aria-controls={sceneId} onClick={()=>setCamera(value=>Math.min(16,value+8))}><span>Right</span> ↷</button>
    </div>
   </div>
  </div>
  <div className={styles.outcomes} aria-label="Possible outcome categories, not actual results">
   <p className={styles.outcomeHeading}>An outcome is a question of evidence.</p>
   <div><p><span>Confirmed evidence</span>Inspect the actual recorded result.</p><p><span>Refused</span>The action was declined.</p><p><span>Unknown</span>Keep the original record; inspect before acting.</p></div>
  </div>
  <div className={styles.limits}><p>Check your installed version and enabled workflow for available controls.</p><p>Governance Intelligence remains incomplete; this illustration does not establish activation or action coverage.</p></div>
 </section>;
}
