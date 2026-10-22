"use client";
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Keyboard-contained confirmation. It never performs the protected action itself. */
export function ConfirmDialog({title, children, onCancel, onConfirm, confirmLabel, busy = false, returnFocusRef}: {title:string;children?:ReactNode;onCancel:()=>void;onConfirm:()=>void;confirmLabel:string;busy?:boolean;returnFocusRef?:RefObject<HTMLElement|null>}) {
 const titleId=useId();
 const descriptionId=useId();
 const dialog=useRef<HTMLDivElement>(null);
 const cancel=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const previous=document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const overflow=document.body.style.overflow;
  const fallback=returnFocusRef?.current;
  document.body.style.overflow="hidden";
  cancel.current?.focus();
  return ()=>{document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();else fallback?.focus();};
 },[returnFocusRef]);
 useEffect(()=>{if(busy)dialog.current?.focus();},[busy]);
 return createPortal(<div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-5 backdrop-blur-sm" onKeyDown={event=>{
  if(event.key==="Escape" && !busy){event.preventDefault();event.stopPropagation();onCancel();}
  if(event.key!=="Tab")return;
  const elements=dialog.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]');
  if(!elements?.length){event.preventDefault();dialog.current?.focus();return;}
  const first=elements[0],last=elements[elements.length-1];
  if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
 }}><div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-[#191919] p-6 text-zinc-100 shadow-2xl"><div className="flex items-start justify-between gap-4"><h2 id={titleId} className="text-base font-medium tracking-tight">{title}</h2><button type="button" onClick={onCancel} disabled={busy} aria-label="Close dialog" className="-mr-1 -mt-1 rounded-md p-1.5 text-zinc-400 hover:bg-white/5 disabled:opacity-50"><X size={16}/></button></div><div id={descriptionId} className="mt-3 text-sm leading-6 text-zinc-400">{children}</div><div className="mt-6 flex justify-end gap-2"><button ref={cancel} type="button" disabled={busy} onClick={onCancel} className="min-h-9 rounded-lg border border-white/10 px-4 text-xs text-zinc-200 hover:bg-white/5 disabled:opacity-50">Cancel</button><button type="button" disabled={busy} onClick={onConfirm} className="min-h-9 rounded-lg bg-rose-400 px-4 text-xs font-semibold text-rose-950 hover:bg-rose-300 disabled:opacity-50">{busy ? "Updating…" : confirmLabel}</button></div></div></div>, document.body);
}
