"use client";
import {useEffect,useState,type RefObject} from 'react';
export const PREVIEW_REVEAL_MS=4800;
const staticState={fraction:1,active:false,reducedMotion:true};
/** Finite paint-only demonstration. No step/decision/execution state changes.
 * SSR/unsupported motion stays fully readable. No background clock or loop. */
export function usePreviewSequence(container:RefObject<HTMLElement|null>,key='initial'){
 const [state,setState]=useState(staticState);
 useEffect(()=>{
  if(typeof window.matchMedia!=='function'||typeof IntersectionObserver==='undefined'){
   setState(staticState);return;
  }
  let current=true,visible=false,started=false,finished=false,elapsed=0,last=0;
  let timer:number|undefined;
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const stop=()=>{if(timer!==undefined){window.clearInterval(timer);timer=undefined}};
  const emit=(active:boolean)=>{if(current)setState({fraction:started?Math.min(1,elapsed/PREVIEW_REVEAL_MS):1,active,reducedMotion:media.matches})};
  const sync=()=>{
   if(!current)return;
   if(media.matches){finished=true;started=true;elapsed=PREVIEW_REVEAL_MS;stop();emit(false);return}
   if(finished||!visible||document.hidden){stop();emit(false);return}
   if(timer!==undefined)return;
   started=true;last=performance.now();emit(true);
   timer=window.setInterval(()=>{
    if(!current)return;
    const now=performance.now();elapsed=Math.min(PREVIEW_REVEAL_MS,elapsed+Math.max(0,now-last));last=now;
    if(elapsed>=PREVIEW_REVEAL_MS){finished=true;stop();emit(false)}else emit(true);
   },60);
  };
  const observer=new IntersectionObserver(entries=>{if(!current)return;const entry=entries[0];visible=!!entry?.isIntersecting&&entry.intersectionRatio>=0.1;sync()},{threshold:0.1});
  media.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);
  setState(staticState);if(container.current)observer.observe(container.current);sync();
  return()=>{current=false;stop();observer.disconnect();media.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync)};
 },[container,key]);
 return state;
}
