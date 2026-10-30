import {invoke} from '@tauri-apps/api/core';
import {getCurrentWindow} from '@tauri-apps/api/window';
/** Application activation, not key-window focus: owned native review dialogs stay foreground. */
export async function subscribeNativeObservationFocus(change:(focused:boolean)=>void):Promise<()=>void>{
 const window=getCurrentWindow();if(window.label!=='main')throw Error('native_observation_focus_unavailable');
 let stopped=false,lastSequence=0,lastActive:boolean|undefined;
 const remove=await window.listen<unknown>('native-observation-application-focus',event=>{
  if(stopped)return;
  const value=event.payload as {sequence?:unknown;active?:unknown}|null;
  if(!value||typeof value.sequence!=='number'||!Number.isSafeInteger(value.sequence)||value.sequence<1||typeof value.active!=='boolean'){lastActive=false;change(false);return}
  if(value.sequence<=lastSequence)return;
  lastSequence=value.sequence;
  if(lastActive===value.active)return;lastActive=value.active;change(value.active);
 });
 try{await invoke('computer_observation_focus_subscribe')}catch(error){stopped=true;remove();throw error}
 return()=>{if(stopped)return;stopped=true;remove()};
}
