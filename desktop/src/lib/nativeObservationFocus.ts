import {getCurrentWindow} from '@tauri-apps/api/window';
/** Metadata-only owned main-window events; never captures or requests permission. */
export async function subscribeNativeObservationFocus(change:(focused:boolean)=>void):Promise<()=>void>{
 const window=getCurrentWindow();if(window.label!=='main')throw Error('native_observation_focus_unavailable');
 return window.onFocusChanged(event=>change(event.payload));
}
