// Synthetic, model-free measurement of the existing pure prompt-budget helper.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {boundedConversationPrompt, currentConversationRequestWithinBudget, CONVERSATION_PROMPT_LIMITS} from '../../../lib/axiom/agentRuntime/conversationPromptBudget.ts';

const source = new URL('../../../lib/axiom/agentRuntime/conversationPromptBudget.ts', import.meta.url);
const sourceHash = createHash('sha256').update(readFileSync(source)).digest('hex');
const bytes = text => Buffer.byteLength(text, 'utf8');
const report = [];
function measure(name, turns, options, check) {
  const original = JSON.stringify(turns);
  const output = boundedConversationPrompt(turns, options);
  check(output);
  assert.equal(JSON.stringify(turns), original);
  report.push({name, inputContentBytes: turns.reduce((n,t) => n + bytes(t.content),0), promptTranscriptBytes:bytes(output), savedInputUnchanged:true});
}
const current = {role:'user',content:'Explain the recorded release status; do not execute anything.'};
measure('long synthetic prior history', [...Array.from({length:48},(_,i)=>({role:i%2?'assistant':'user',content:`Historical synthetic turn ${i}: `+'context '.repeat(280)})),current], {}, output=>{
  assert.ok(output.endsWith(current.content));
  assert.ok(bytes(output)<=CONVERSATION_PROMPT_LIMITS.transcriptBytes);
  assert.ok(output.includes('Earlier conversation omitted'));
});
measure('newest request at its byte limit', [{role:'user',content:'x'.repeat(CONVERSATION_PROMPT_LIMITS.currentRequestBytes)}], {}, output=>{
  assert.equal(output,'[user] '+'x'.repeat(CONVERSATION_PROMPT_LIMITS.currentRequestBytes));
});
const fresh='完整的合成证据 — no provider data. '.repeat(30);
measure('fresh Unicode tool evidence retained whole', [current,{role:'tool_result',content:fresh}], {completeToolResultsFromIndex:1}, output=>{
  assert.ok(output.includes('[tool_result] '+fresh));
});
const overRequest=[{role:'user',content:'x'.repeat(CONVERSATION_PROMPT_LIMITS.currentRequestBytes+1)}];
assert.equal(currentConversationRequestWithinBudget(overRequest),false);
assert.throws(()=>boundedConversationPrompt(overRequest),/current_request_context_too_large/);
report.push({name:'oversized newest request',refused:true,limitBytes:CONVERSATION_PROMPT_LIMITS.currentRequestBytes});
assert.throws(()=>boundedConversationPrompt([current,{role:'tool_result',content:'e'.repeat(70000)}],{completeToolResultsFromIndex:1}),error=>error.name==='CurrentToolEvidenceLimitError');
report.push({name:'fresh evidence cannot fit',refused:true,toolContentBytes:70000,partialEvidenceProduced:false});
assert.equal(createHash('sha256').update(readFileSync(source)).digest('hex'),sourceHash);
console.log(JSON.stringify({scope:'Existing pure helper; synthetic UTF8-byte measurements only. No model/token/cost/quality benchmark.',sourceSha256:sourceHash,limits:CONVERSATION_PROMPT_LIMITS,cases:report,sourceUnchanged:true,modelCalls:0,providerCalls:0,databaseCalls:0},null,2));
