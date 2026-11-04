import {useEffect,useRef,type KeyboardEvent,type FocusEvent} from 'react';

/** Only for floating menus. Closing keeps children mounted and never submits or
 * discards their form state. Inline evidence/review disclosures do not use it. */
export function useDismissibleDetails(){
 const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{
   const menu=ref.current;
   if(menu?.open&&event.target instanceof Node&&!menu.contains(event.target))menu.open=false;
  };
  document.addEventListener('pointerdown',outside,true);
  return()=>document.removeEventListener('pointerdown',outside,true);
 },[]);
 const onKeyDown=(event:KeyboardEvent<HTMLDetailsElement>)=>{
  if(event.nativeEvent.isComposing||event.nativeEvent.keyCode===229)return;
  if(event.key==='Escape'&&event.currentTarget.open){
   event.preventDefault();event.stopPropagation();event.currentTarget.open=false;
   event.currentTarget.querySelector('summary')?.focus();
  }
 };
 const onBlur=(event:FocusEvent<HTMLDetailsElement>)=>{
  if(event.relatedTarget instanceof Node&&!event.currentTarget.contains(event.relatedTarget))event.currentTarget.open=false;
 };
 return{ref,onKeyDown,onBlur};
}
