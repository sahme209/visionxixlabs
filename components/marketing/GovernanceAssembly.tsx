"use client";

import {useId,useRef,useState,type KeyboardEvent} from 'react';
import {ASSEMBLY_STAGES,DEPLOYMENT_OBJECTS,PRIMARY_OBJECTS,deriveAssembly,type AssemblyView,type DeploymentObjectId} from './governanceAssemblyModel';
import {DeploymentConstellationScene} from './DeploymentConstellationScene';
import styles from './GovernanceAssembly.module.css';

export function GovernanceAssembly({compact=false}:{compact?:boolean}){
 const prefix=useId(),panelId=`${prefix}-record`,sceneId=`${prefix}-scene`,helpId=`${prefix}-help`;
 const [committed,setCommitted]=useState<DeploymentObjectId>('repository'),[hovered,setHovered]=useState<DeploymentObjectId|null>(null),[focused,setFocused]=useState<DeploymentObjectId|null>(null),[view,setView]=useState<AssemblyView>('inspect'),[camera,setCamera]=useState(0);
 const controls=useRef<(HTMLButtonElement|null)[]>([]);
 const [detailsOpen,setDetailsOpen]=useState(false);
 function selectStage(index:number){setCommitted(PRIMARY_OBJECTS[index]);setHovered(null);setFocused(null);setView('inspect');if(compact)setDetailsOpen(true)}
 function commitObject(id:DeploymentObjectId){setCommitted(id);setHovered(null);setFocused(null);setView('inspect')}
 const model=deriveAssembly({selected:0,objectId:hovered??focused??committed,view,camera}),selected=model.selected;
 function navigate(event:KeyboardEvent<HTMLButtonElement>,index:number){
  if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.nativeEvent.isComposing||event.nativeEvent.keyCode===229)return;
  const key=event.key;const next=key==='Home'?0:key==='End'?4:key==='ArrowRight'||key==='ArrowDown'?(index+1)%5:key==='ArrowLeft'||key==='ArrowUp'?(index+4)%5:null;
  if(next===null)return;event.preventDefault();selectStage(next);controls.current[next]?.focus();
 }
 const recordPanel=(
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
 );
 return <section className={`${styles.assembly} ${compact?styles.compact:''}`} aria-label="Explore the deployment constellation">
  <div className={styles.intro}><p className={styles.eyebrow}>Inside a deployment decision</p><p className={styles.instruction}>Inspect the objects behind a deployment.</p></div>
  <p id={helpId} className={styles.caption}>Conceptual illustration · local explanation only. Hover, focus or choose an object to inspect its record; no actions are performed.</p>
  <noscript><div className={styles.staticReading}>
   <h3>Read the complete workflow</h3><p>Interactive controls require JavaScript. All five conceptual records and their limits are available below.</p>
   <ul aria-label="Deployment objects">{DEPLOYMENT_OBJECTS.map(object=><li key={object.id}><h4>{object.label}</h4><p>{object.detail}</p></li>)}</ul>
   <ol>{ASSEMBLY_STAGES.map(stage=><li key={stage.number}><h4>{stage.number} · {stage.title}</h4><p>{stage.detail}</p><p>{stage.boundary}</p></li>)}</ol>
  </div></noscript>
  <ol aria-label="Conceptual workflow" aria-describedby={helpId} className={styles.stages}>
   {ASSEMBLY_STAGES.map((stage,index)=><li key={stage.number}><h3><button id={`${prefix}-stage-${index+1}`} ref={node=>{controls.current[index]=node}} type="button" aria-pressed={selected===index} aria-controls={panelId} onClick={()=>selectStage(index)} onKeyDown={event=>navigate(event,index)}><span className={styles.number} aria-hidden="true">{stage.number}</span><span>{stage.title}</span></button></h3></li>)}
  </ol>
  <div className={styles.workspace}>
   <div className={styles.visual}>
    <div className={styles.constellation}>
     <svg id={sceneId} className={styles.scene} viewBox="0 0 640 470" role="img" aria-label={`Deployment constellation — ${model.object.label}. Conceptual objects, no actions performed.`} data-selected-stage={model.selected} data-view={model.view} data-inspected-object={model.object.id}>
      <title>Repository, artifact, review gate, services, environments and evidence</title><desc>Seven original deployment objects. Production remains held behind a broken conceptual route. Hover, keyboard focus and touch buttons inspect the same local model.</desc>
      <DeploymentConstellationScene model={model} prefix={prefix} onHover={setHovered} onLeave={()=>setHovered(null)}/>
     </svg>
     <div className={styles.objectControls} role="group" aria-label="Deployment object inspection">
      {DEPLOYMENT_OBJECTS.map(object=><button key={object.id} type="button" className={styles.objectButton} aria-label={`Inspect ${object.label}`} aria-controls={panelId} aria-describedby={`${prefix}-inspection`} aria-pressed={committed===object.id} data-active={model.object.id===object.id} onPointerEnter={event=>{if(event.pointerType!=='touch')setHovered(object.id)}} onPointerLeave={()=>setHovered(null)} onFocus={()=>setFocused(object.id)} onBlur={()=>setFocused(null)} onClick={()=>commitObject(object.id)}><span>{object.label}</span></button>)}
     </div>
    </div>
    <p id={`${prefix}-inspection`} className={styles.inspectionReadout}><strong>{model.object.label}</strong><span>{model.object.detail}</span></p>
   </div>
   {compact?<details className={styles.compactDetails} open={detailsOpen} onToggle={event=>setDetailsOpen(event.currentTarget.open)}><summary>Read the selected record</summary>{recordPanel}</details>:recordPanel}
  </div>
  <div className={styles.outcomes} aria-label="Possible outcome categories, not actual results">
   <p className={styles.outcomeHeading}>An outcome is a question of evidence.</p>
   <div><p><span>Confirmed evidence</span>Inspect the actual recorded result.</p><p><span>Refused</span>The action was declined.</p><p><span>Unknown</span>Keep the original record; inspect before acting.</p></div>
  </div>
  <div className={styles.limits}><p>Check your installed version and enabled workflow for available controls.</p><p>Governance Intelligence remains incomplete; this illustration does not establish activation or action coverage.</p></div>
 </section>;
}
