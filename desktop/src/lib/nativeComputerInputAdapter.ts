import {invoke} from '@tauri-apps/api/core';
import type {ComputerInputAdapter} from './computerInputContract';
/** Fixed native IPC only. Availability and one-action authority are independently checked by native code. */
export function createNativeComputerInputAdapter():ComputerInputAdapter{
 return{
  status:async(signal,task)=>{signal.throwIfAborted();return task?invoke('computer_input_status',{input:task}):invoke('computer_input_status')},
  prepare:async(input,signal)=>{signal.throwIfAborted();return invoke('computer_input_prepare',{input})},
  confirm:async(input,signal)=>{signal.throwIfAborted();return invoke('computer_input_confirm',{input})},
  recover:async(input,signal)=>{signal.throwIfAborted();return invoke('computer_input_recover',{input})},
  stop:input=>invoke('computer_input_stop',{input}),
 };
}
