import {invoke} from '@tauri-apps/api/core';
import type {NativeObservationAdapter} from './nativeObservationContract';
/** Native commands alone determine availability. No browser screenshot fallback. */
export function createNativeObservationAdapter():NativeObservationAdapter{
 return{current:async(input,signal)=>{signal.throwIfAborted();return invoke('computer_observation_current',{input})},status:async signal=>{signal.throwIfAborted();return invoke('computer_observation_status')},select:async(ownerContextRef,signal)=>{signal.throwIfAborted();return invoke('computer_observation_select',{input:{ownerContextRef,confirmSelect:true}})},capture:async(input,signal)=>{signal.throwIfAborted();return invoke('computer_observation_capture',{input:{...input,confirmCapture:true}})},stop:input=>invoke('computer_observation_stop',{input})};
}
