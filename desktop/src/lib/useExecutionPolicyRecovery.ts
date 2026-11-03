import {useEffect,useMemo,useState} from 'react';
import {desktopClient} from './desktopClient';
import {createExecutionPolicyRecoveryStore,executionPolicyRecoveryReference,type ExecutionPolicyRecoveryRecord} from './executionPolicyRecoveryStore';
import type {ExecutionPolicyMutation} from './governanceExecutionPolicy';
/** Local inert journal only. Neither presence nor absence authorizes a mutation. */
export function useExecutionPolicyRecovery(organizationId:string,userId:string){
 const base=desktopClient.config.apiBase;
 const store=useMemo(()=>{try{return createExecutionPolicyRecoveryStore({serviceOrigin:base,organizationId,userId})}catch{return undefined}},[base,organizationId,userId]);
 const read=()=>{try{return{records:store!.list(),unavailable:false}}catch{return{records:[] as ExecutionPolicyRecoveryRecord[],unavailable:true}}};
 const[state,setState]=useState(read);
 const refresh=()=>setState(read());
 useEffect(()=>{refresh();const off=store?.subscribe(refresh);const changed=()=>refresh();globalThis.addEventListener?.('storage',changed);return()=>{off?.();globalThis.removeEventListener?.('storage',changed)}},[store]);
 return{
  ...state,blocked:state.unavailable||state.records.length>0,
  canRevoke(id:string){return !state.unavailable&&!state.records.some(r=>r.reference.operation==='revoke'&&r.reference.id===id)},
  reserve(request:ExecutionPolicyMutation){try{if(!store)throw Error();const record=store.reserve(request);refresh();return record}catch{setState({...read(),unavailable:true});throw Error('local_recovery_unavailable')}},
  acknowledge(record:ExecutionPolicyRecoveryRecord){try{if(!store)throw Error();store.acknowledge(record);refresh()}catch{setState({...read(),unavailable:true});throw Error('local_recovery_unavailable')}},
  acknowledgeRequest(request:ExecutionPolicyMutation){try{const reference=executionPolicyRecoveryReference(request),record=store?.list().find(r=>JSON.stringify(r.reference)===JSON.stringify(reference));if(!record||!store)throw Error();store.acknowledge(record);refresh()}catch{setState({...read(),unavailable:true});throw Error('local_recovery_unavailable')}},
 };
}
