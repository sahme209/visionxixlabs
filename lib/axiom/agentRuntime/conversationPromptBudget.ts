import type {ConversationTurnInput} from './decisionLoop';
/** Prompt-only bounds. Stored conversation history is never rewritten. */
export const CONVERSATION_PROMPT_LIMITS=Object.freeze({historyTurns:32,executionHistoryChars:2000,currentRequestBytes:32768,transcriptBytes:65536,historicalBytes:32768,olderTurnBytes:4096,toolResultBytes:8192});
const omitted='[Earlier conversation omitted to fit the context budget; saved history is unchanged.]';
const truncated='\n[Content truncated to fit the context budget; remaining content is not shown.]';
function validText(value:string){return Buffer.from(value,'utf8').toString('utf8')}
function prefix(value:string,maxBytes:number){let text='',bytes=0;for(const point of value){const size=Buffer.byteLength(point,'utf8');if(bytes+size>maxBytes)break;text+=point;bytes+=size}return text}
function boundedText(value:string,maxBytes:number){const text=validText(value);return Buffer.byteLength(text)<=maxBytes?text:prefix(text,Math.max(0,maxBytes-Buffer.byteLength(truncated)))+truncated}
export function currentConversationRequestWithinBudget(turns:readonly ConversationTurnInput[]){for(let i=turns.length-1;i>=0;i--)if(turns[i].role==='user')return Buffer.byteLength(turns[i].content,'utf8')<=CONVERSATION_PROMPT_LIMITS.currentRequestBytes;return true}
/** Newest user stays intact. Recent evidence is explicitly partial when shortened.
 * Scope/profile/system instructions are deliberately supplied outside this text. */
export class CurrentToolEvidenceLimitError extends Error {constructor(){super('current_tool_evidence_too_large');this.name='CurrentToolEvidenceLimitError'}}
export function boundedConversationPrompt(turns:readonly ConversationTurnInput[],options:{completeToolResultsFromIndex?:number;earlierHistoryOmitted?:boolean}={}):string{
 if(!currentConversationRequestWithinBudget(turns))throw new Error('current_request_context_too_large');
 let newestUser=-1;for(let i=turns.length-1;i>=0;i--)if(turns[i].role==='user'){newestUser=i;break}
 const selected=new Map<number,string>();
 if(newestUser>=0)selected.set(newestUser,`[user] ${validText(turns[newestUser].content)}`);
 // Fresh observations must never become partial source evidence. If they
 // cannot fit, stop before another model decision or write proposal.
 if(options.completeToolResultsFromIndex!==undefined){
  for(let i=options.completeToolResultsFromIndex;i<turns.length;i++)if(turns[i].role==='tool_result')selected.set(i,`[tool_result] ${validText(turns[i].content)}`);
 }
 const mandatoryBytes=[...selected.values()].reduce((bytes,value)=>bytes+Buffer.byteLength(value)+2,0);
 const available=CONVERSATION_PROMPT_LIMITS.transcriptBytes-mandatoryBytes-Buffer.byteLength(omitted)-4;
 if(available<0)throw new CurrentToolEvidenceLimitError();
 let remaining=Math.min(CONVERSATION_PROMPT_LIMITS.historicalBytes,available);
 for(let i=turns.length-1;i>=0&&selected.size<CONVERSATION_PROMPT_LIMITS.historyTurns;i--){
  if(selected.has(i))continue;
  const turn=turns[i],role=turn.role;if(!['user','assistant','tool_result'].includes(role))continue;
  const label=`[${role}] `,max=Math.min(role==='tool_result'?CONVERSATION_PROMPT_LIMITS.toolResultBytes:CONVERSATION_PROMPT_LIMITS.olderTurnBytes,remaining-Buffer.byteLength(label)-2);
  if(max<Buffer.byteLength(truncated)+8)break;
  const text=label+boundedText(turn.content,max);remaining-=Buffer.byteLength(text)+2;selected.set(i,text);
 }
 const text=[...selected].sort(([a],[b])=>a-b).map(([,value])=>value).join('\n\n');
 const result=options.earlierHistoryOmitted||selected.size<turns.length?`${omitted}\n\n${text}`:text;
 if(Buffer.byteLength(result)>CONVERSATION_PROMPT_LIMITS.transcriptBytes)throw new Error('conversation_context_budget_exceeded');
 return result;
}
