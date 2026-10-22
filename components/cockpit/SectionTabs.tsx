"use client";
import { useId, useRef, useState, type ReactNode } from "react";
export function SectionTabs({items, label, keepMounted=false}: {items:Array<{id:string;label:string;content:ReactNode}>;label:string;keepMounted?:boolean}) {
 const [selected,setSelected]=useState(items[0]?.id);
 const prefix=useId();
 const buttons=useRef<Array<HTMLButtonElement|null>>([]);
 return <><div role="tablist" aria-label={label} className="my-7 flex max-w-full gap-1 overflow-x-auto pb-0">{items.map((item,index)=><button ref={node=>{buttons.current[index]=node;}} key={item.id} type="button" role="tab" id={`${prefix}-${item.id}-tab`} aria-selected={selected===item.id} aria-controls={`${prefix}-${item.id}-panel`} tabIndex={selected===item.id ? 0:-1} onClick={()=>setSelected(item.id)} onKeyDown={event=>{
 let next=index;
 if(event.key==="ArrowRight")next=(index+1)%items.length;
 else if(event.key==="ArrowLeft")next=(index+items.length-1)%items.length;
 else if(event.key==="Home")next=0;
 else if(event.key==="End")next=items.length-1;
 else return;
 event.preventDefault();setSelected(items[next].id);buttons.current[next]?.focus();
 }} className={`min-h-8 whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] transition ${selected===item.id ? "bg-white/10 text-zinc-100":"text-zinc-400 hover:bg-white/5 hover:text-white"}`}>{item.label}</button>)}</div>{items.map(item=>(keepMounted || selected===item.id) && <div key={item.id} role="tabpanel" id={`${prefix}-${item.id}-panel`} aria-labelledby={`${prefix}-${item.id}-tab`} hidden={selected!==item.id}>{item.content}</div>)}</>;
}
