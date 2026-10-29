import {useEffect,useRef,useState} from 'react';
import {desktopClient} from './desktopClient';
import {normalizeAiProviderStatus} from './aiProviderStatus';
import {agentModelChoices,type AgentModelChoice} from './agentModelSelection';
import {isBotAiEvidenceContext,type BotAiEvidenceContext,isBotAiModelId,isBotAiResultResponse,type BotAiRunDto,type BotAiResultResponseDto,type BotAiStartDto} from '../../../lib/axiom/bot/aiTaskDto';
import type {SavedBotTaskDto} from '../../../lib/axiom/bot/savedTaskContract';
type UnknownRecord={taskId:string;runId:string};
type Marker=BotAiStartDto|(Pick<BotAiStartDto,'taskId'|'expectedVersion'|'modelId'>&{runId:string});
const terminal=(run:BotAiRunDto)=>['completed','needs_input','failed','canceled'].includes(run.status);
/** Recovery markers contain request identities only. The server supplies a stable
 * opaque user+tenant scope; editor generations and emails are not identities. */
export function useBotAiTask(ownerKey:string){
 const initial=useRef({config:desktopClient.config,revision:desktopClient.getContextRevision(),owner:ownerKey}).current;
 const mounted=useRef(true),sendOperation=useRef<AbortController|null>(null),readOperation=useRef<AbortController|null>(null),refreshOperation=useRef<AbortController|null>(null);
 const unknownRecords=useRef<UnknownRecord[]>([]),recoveryIntegrity=useRef(true);
 const storageKey=useRef<string|null>(null),marker=useRef<Marker|null>(null),latest=useRef<BotAiRunDto|null>(null),selectedModel=useRef('');
 const [loading,setLoading]=useState(true),[enabled,setEnabled]=useState(false),[sending,setSending]=useState(false),[checking,setChecking]=useState(false),[uncertain,setUncertain]=useState(false);
 const [models,setModels]=useState<AgentModelChoice[]>([]),[modelKey,setModelKey]=useState(''),[blockedTaskIds,setBlockedTaskIds]=useState<string[]>([]),[recent,setRecent]=useState<BotAiRunDto[]>([]),[error,setError]=useState<string>(),[run,setRun]=useState<BotAiRunDto|null>(null),[result,setResult]=useState<BotAiResultResponseDto['result']>(null);
 const owns=()=>mounted.current&&ownerKey===initial.owner&&desktopClient.config===initial.config&&desktopClient.getContextRevision()===initial.revision;
 function apply(next:BotAiRunDto,detail:BotAiResultResponseDto['result']=null,expected:Pick<Marker,'taskId'|'expectedVersion'|'modelId'>|null=marker.current){
  if(!owns())return false;
  const pending=expected;
  if(pending&&(next.taskId!==pending.taskId||next.taskVersion!==pending.expectedVersion||next.modelId!==pending.modelId)){setError('The returned task does not match this send. Check the original request.');setUncertain(true);return false}
  if(latest.current?.id===next.id){if(latest.current.taskId!==next.taskId||latest.current.taskVersion!==next.taskVersion||latest.current.modelId!==next.modelId){setError('Task identity changed unexpectedly. Reopen the saved task.');setUncertain(true);return false}if(latest.current.revision>next.revision)return false}
  latest.current=next;setRun(next);setResult(detail);
  let acknowledged=false;try{acknowledged=next.status==='outcome_unknown'&&Boolean(storageKey.current)&&unknownRecords.current.some(item=>item.taskId===next.taskId&&item.runId===next.id)}catch{/* Keep the unknown outcome blocked. */}
  setUncertain(next.status==='outcome_unknown'?!acknowledged:!terminal(next));return true;
 }
 function readMarker(key:string){
  try{const text=localStorage.getItem(key);if(!text)return null;if(text.length>2048)throw new Error();const value=JSON.parse(text) as Marker;
   const keys=Object.keys(value).sort().join(',');
   const validRequest=(keys==='clientRequestId,confirmSend,expectedVersion,kind,modelId,taskId'||keys==='clientRequestId,confirmSend,evidenceContext,expectedVersion,kind,modelId,taskId'&&'evidenceContext' in value&&isBotAiEvidenceContext(value.evidenceContext))&&'clientRequestId' in value&&value.kind==='ai_task_response_v1'&&value.confirmSend===true&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.clientRequestId);
   const validRecorded=keys==='expectedVersion,modelId,runId,taskId'&&'runId' in value&&/^botai_[a-f0-9]{64}$/.test(value.runId);
   if((!validRequest&&!validRecorded)||!/^bot_[a-f0-9]{64}$/.test(value.taskId)||!Number.isSafeInteger(value.expectedVersion)||value.expectedVersion<0||value.expectedVersion>2147483647||!isBotAiModelId(value.modelId))throw new Error();return value;
  }catch{setError('The local recovery marker could not be read. Review saved task activity before sending again.');setUncertain(true);return null}
 }
 async function check(){
  if(!owns()||readOperation.current)return;
  const pending=marker.current,existing=latest.current;if(!pending&&!existing)return;
  const controller=new AbortController();readOperation.current=controller;setChecking(true);setError(undefined);
  try{
   const found=existing?{ok:true as const,data:{run:existing}}:pending&&'runId' in pending?await desktopClient.getBotAiRun(pending.runId,controller.signal):await desktopClient.findBotAiRun((pending as BotAiStartDto).clientRequestId,controller.signal);
   if(!owns()||controller.signal.aborted)return;
   if(!found.ok){setError(found.error);setUncertain(true);return}
   if(isBotAiResultResponse(found.data)){apply(found.data.run,found.data.result);return}
   if(!apply(found.data.run))return;
   const detail=await desktopClient.getBotAiRun(found.data.run.id,controller.signal);
   if(!owns()||controller.signal.aborted)return;
   if(detail.ok)apply(detail.data.run,detail.data.result);else{setError(detail.error);setUncertain(true)}
  }catch{if(owns()){setError('Task status is unavailable. Check this same request before sending again.');setUncertain(true)}}
  finally{if(readOperation.current===controller){readOperation.current=null;if(owns())setChecking(false)}}
 }
 async function refresh(){
  if(!owns()||refreshOperation.current)return;const controller=new AbortController();refreshOperation.current=controller;setLoading(true);setError(undefined);
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('timeout'))},25000)});
   const capabilities=await Promise.race([desktopClient.botAiCapabilities(controller.signal),timeout]);
   if(!owns()||controller.signal.aborted)return;
   if(!capabilities.ok){setEnabled(false);setError(capabilities.error);return}
   const cap=capabilities.data;setEnabled(cap.enabled&&cap.canSend);
   if(!/^bot_scope_[a-f0-9]{64}$/.test(cap.recoveryScope)){setEnabled(false);setError('A verified recovery scope is required before sending.');return}
   const base=new URL(initial.config.apiBase);if(base.username||base.password||base.search||base.hash||!['https:','http:'].includes(base.protocol))throw new Error('invalid base');
   const key=`axiom.bot.ai.request.v1:${encodeURIComponent(base.origin+base.pathname)}:${cap.recoveryScope}`;
   if(storageKey.current&&storageKey.current!==key){setEnabled(false);setError('Workspace changed. Reopen Bot in the current verified workspace.');return}
   storageKey.current=key;
   try{const text=localStorage.getItem(key+':unknown-records');const records:unknown=text?JSON.parse(text):[];if((text?.length??0)>24000||!Array.isArray(records)||records.length>128||records.some(item=>!item||typeof item!=='object'||Object.keys(item).sort().join(',')!=='runId,taskId'||typeof item.taskId!=='string'||!/^bot_[a-f0-9]{64}$/.test(item.taskId)||typeof item.runId!=='string'||!/^botai_[a-f0-9]{64}$/.test(item.runId))||new Set(records.map(item=>item.taskId)).size!==records.length)throw new Error();unknownRecords.current=records as UnknownRecord[];setBlockedTaskIds(unknownRecords.current.map(item=>item.taskId));recoveryIntegrity.current=true}catch{recoveryIntegrity.current=false;setEnabled(false);setError('Recovery records could not be verified. Saved tasks remain available; review their recorded activity before sending.');return}
   if(!marker.current){marker.current=readMarker(storageKey.current);if(marker.current){setUncertain(true);void check()}}
   if(!cap.enabled||!cap.canSend){setModels([]);selectedModel.current='';setModelKey('');return}
   const raw=await Promise.race([desktopClient.aiProviderStatus(),timeout]);
   if(!owns()||controller.signal.aborted)return;
   const normalized=raw.ok?normalizeAiProviderStatus(raw.data):null;
   if(!normalized){setModels([]);selectedModel.current='';setModelKey('');setError('Approved models could not be verified. Refresh before sending.');return}
   const choices=agentModelChoices(normalized).filter(choice=>choice.provider==='vercel_gateway'&&choice.preferredModel&&isBotAiModelId(choice.modelId));setModels(choices);
   const current=choices.find(choice=>choice.key===selectedModel.current&&!choice.unavailableReason)??choices.find(choice=>choice.modelId===normalized.policy.modelSelections.vercel_gateway&&!choice.unavailableReason);
   selectedModel.current=current?.key??'';setModelKey(selectedModel.current);
  }catch{if(owns()){setEnabled(false);setError('AI task setup is unavailable. Your draft is retained; refresh when the service is available.')}}
  finally{clearTimeout(timer);if(refreshOperation.current===controller){refreshOperation.current=null;if(owns())setLoading(false)}}
 }
 function chooseModel(key:string){if(sendOperation.current||uncertain)return;const choice=models.find(item=>item.key===key&&!item.unavailableReason);if(choice){selectedModel.current=key;setModelKey(key)}}
 async function send(task:SavedBotTaskDto,evidenceContext?:BotAiEvidenceContext){
  if(evidenceContext!==undefined&&!isBotAiEvidenceContext(evidenceContext)){setError("The selected evidence could not be verified. Clear it and select the saved evidence again.");return}
  if(!owns()||sendOperation.current||readOperation.current||loading||!enabled||uncertain||!storageKey.current)return;
  if(!recoveryIntegrity.current||unknownRecords.current.some(item=>item.taskId===task.id)){setError("This task has an uncertain earlier call. Start a new draft for distinct work; the original will not be retried.");return}
  const choice=models.find(item=>item.key===selectedModel.current&&!item.unavailableReason);if(!choice?.preferredModel)return;
  const controller=new AbortController();sendOperation.current=controller;setSending(true);setError(undefined);setResult(null);
  const input:BotAiStartDto={taskId:task.id,expectedVersion:task.version,kind:'ai_task_response_v1',modelId:choice.preferredModel,clientRequestId:crypto.randomUUID(),confirmSend:true,...(evidenceContext?{evidenceContext:{...evidenceContext}}:{})};
  try{
   try{localStorage.setItem(storageKey.current,JSON.stringify(input))}catch{setError('A recovery marker could not be saved. Nothing was sent. Restore local storage before trying again.');return}
   marker.current=input;latest.current=null;setRun(null);setUncertain(true);
   const response=await desktopClient.sendBotAiTask(input,controller.signal);
   if(!owns()||controller.signal.aborted)return;
   if(response.ok){if(apply(response.data.run))await check()}
   else{setError(response.error);setUncertain(response.outcomeUnconfirmed);if(!response.outcomeUnconfirmed){marker.current=null;localStorage.removeItem(storageKey.current)}}
  }catch{if(owns()){setError('The send outcome is unconfirmed. Check the same request; it will not be sent automatically again.');setUncertain(true)}}
  finally{if(sendOperation.current===controller){sendOperation.current=null;if(owns())setSending(false)}}
 }
 async function cancel(){
  if(!owns()||readOperation.current||checking||!latest.current||terminal(latest.current)||latest.current.status==='outcome_unknown')return;
  const row=latest.current,controller=new AbortController();readOperation.current=controller;setChecking(true);
  try{const response=await desktopClient.cancelBotAiRun(row.id,row.revision,controller.signal);if(!owns()||controller.signal.aborted)return;if(response.ok){apply(response.data.run);setError(response.data.run.status==='cancel_requested'?'Cancellation requested. Dispatched usage may still be charged; check the same task.':undefined)}else setError(response.error)}catch{if(owns())setError('Cancellation is unconfirmed. Check this same task before another action.')}
  finally{if(readOperation.current===controller){readOperation.current=null;if(owns())setChecking(false)}}
 }
 async function loadRecent(taskId:string){
  if(!owns()||readOperation.current||sendOperation.current||uncertain)return;
  const controller=new AbortController();readOperation.current=controller;setChecking(true);setError(undefined);
  try{const response=await desktopClient.botAiRunsForTask(taskId,controller.signal);if(!owns()||controller.signal.aborted)return;if(response.ok)setRecent(response.data.runs);else setError(response.error)}catch{if(owns())setError('Saved task activity is unavailable. Your editor is retained.')}finally{if(readOperation.current===controller){readOperation.current=null;if(owns())setChecking(false)}}
 }
 async function openRecordedRun(item:BotAiRunDto){
  if(!owns()||readOperation.current||sendOperation.current||uncertain)return;
  const controller=new AbortController();readOperation.current=controller;setChecking(true);setError(undefined);
  try{const response=await desktopClient.getBotAiRun(item.id,controller.signal);if(!owns()||controller.signal.aborted)return;if(response.ok){const stored:Marker={taskId:item.taskId,expectedVersion:item.taskVersion,modelId:item.modelId,runId:item.id};if(!storageKey.current)throw new Error('missing recovery scope');localStorage.setItem(storageKey.current,JSON.stringify(stored));marker.current=stored;apply(response.data.run,response.data.result,stored)}else setError(response.error)}catch{if(owns())setError('The saved response is unavailable. No task was sent.')}finally{if(readOperation.current===controller){readOperation.current=null;if(owns())setChecking(false)}}
 }
 function acknowledgeUnknown(){
  if(!owns()||sending||checking||latest.current?.status!=='outcome_unknown'||!storageKey.current)return false;
  const records=[...unknownRecords.current.filter(item=>item.taskId!==latest.current!.taskId),{taskId:latest.current.taskId,runId:latest.current.id}];
  if(records.length>128){setError('The recovery record limit is reached. Preserve this outcome and review saved task activity before new work.');return false}
  try{localStorage.setItem(storageKey.current+':unknown-records',JSON.stringify(records));unknownRecords.current=records;setBlockedTaskIds(records.map(item=>item.taskId))}catch{setError('The acknowledgment could not be saved. No new task was sent.');return false}
  setUncertain(false);setError(undefined);return true;
 }
 useEffect(()=>{mounted.current=true;void refresh();const unsubscribe=desktopClient.subscribeContext(()=>{sendOperation.current?.abort();readOperation.current?.abort();refreshOperation.current?.abort();if(mounted.current){setEnabled(false);setError('Workspace changed. Reopen Bot in the current workspace.')}});return()=>{mounted.current=false;unsubscribe();sendOperation.current?.abort();readOperation.current?.abort();refreshOperation.current?.abort()}},[]);
 return{blockedTaskIds,blockedTaskId:blockedTaskIds[0]??null,acknowledgeUnknown,recent,loadRecent,openRecordedRun,loading,enabled,sending,checking,uncertain,models,modelKey,chooseModel,error,run,result,send,check,cancel,refresh,canSend:owns()&&recoveryIntegrity.current&&!loading&&enabled&&!sending&&!checking&&!uncertain&&Boolean(models.find(item=>item.key===modelKey&&!item.unavailableReason)),canCheck:Boolean(marker.current||run),canCancel:Boolean(run&&!terminal(run)&&run.status!=='outcome_unknown')};
}
export type ReturnTypeOfBotAiTask=ReturnType<typeof useBotAiTask>;
