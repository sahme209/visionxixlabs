"use client";

import {useEffect,useRef,type ReactNode} from "react";

/** Scroll-linked depth only: native scrolling, no autonomous animation or player controls. */
export function PublicFeatureSection({children,labelledBy}:{children:ReactNode;labelledBy:string}) {
  const rootRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    const root=rootRef.current;
    if(!root||typeof window.matchMedia!=="function")return;
    const media=window.matchMedia("(min-width:1024px) and (min-height:760px) and (prefers-reduced-motion:no-preference)");
    const panels=Array.from(root.querySelectorAll<HTMLElement>(":scope > .public-feature-panel"));
    const previous=new Map<HTMLElement,number>();
    let frame=0,disposed=false;
    const update=()=>{
      frame=0;if(disposed)return;
      const heights=panels.map(panel=>panel.offsetHeight);
      const enabled=media.matches&&heights.length>1&&heights.every(height=>height>0&&height<=window.innerHeight-160);
      const tops=panels.map(panel=>panel.getBoundingClientRect().top+(panel.matches(":focus-within")?0:8*(previous.get(panel)||0)));
      root.dataset.stackReady=String(enabled);
      panels.forEach((panel,index)=>{
        const progress=enabled&&index<panels.length-1?Math.max(0,Math.min(1,1-(tops[index+1]-128)/(heights[index]+24))):0;
        previous.set(panel,progress);
        panel.style.setProperty("--feature-scale",String(1-.04*progress));
        panel.style.setProperty("--feature-lift",`${-8*progress}px`);
      });
    };
    const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(update);};
    const observer=typeof ResizeObserver==="undefined"?null:new ResizeObserver(schedule);
    observer?.observe(root);panels.forEach(panel=>observer?.observe(panel));
    window.addEventListener("scroll",schedule,{passive:true});
    window.addEventListener("resize",schedule);
    root.addEventListener("focusin",schedule);root.addEventListener("focusout",schedule);
    media.addEventListener("change",schedule);schedule();
    return()=>{
      disposed=true;cancelAnimationFrame(frame);observer?.disconnect();
      window.removeEventListener("scroll",schedule);window.removeEventListener("resize",schedule);
      root.removeEventListener("focusin",schedule);root.removeEventListener("focusout",schedule);
      media.removeEventListener("change",schedule);
      delete root.dataset.stackReady;
      panels.forEach(panel=>{panel.style.removeProperty("--feature-scale");panel.style.removeProperty("--feature-lift");});
    };
  },[]);
  return <section ref={rootRef} className="public-feature-section" aria-labelledby={labelledBy}>{children}</section>;
}
