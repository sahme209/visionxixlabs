import {z} from 'zod';
export const ACTION_CONSENT_SCOPES={teams:['openid','offline_access','User.Read','Team.ReadBasic.All','Channel.ReadBasic.All','ChannelMessage.Send'],linear:['read','write']} as const;
const normalizeMicrosoft=(s:string)=>s.replace(/^https:\/\/graph\.microsoft\.com\//i,'').toLowerCase();
/** An action upgrade is a separate, explicit purpose. Identity-only callbacks must
 * never accept these additional grants, and an action flow must never infer them. */
export function validateActionConsentScopes(provider:'teams'|'linear',raw:unknown):string[]{
 const scopes=z.array(z.string().min(1).max(240)).min(1).max(20).parse(raw),normalized=scopes.map(s=>provider==='teams'?normalizeMicrosoft(s):s);
 if(new Set(normalized).size!==normalized.length)throw Error('connected_action_scope_insufficient');
 const allowed=provider==='teams'?[...ACTION_CONSENT_SCOPES.teams,'profile','email'].map(s=>s.toLowerCase()):['read','write','issues:create'];
 const required=provider==='teams'?['user.read','team.readbasic.all','channel.readbasic.all','channelmessage.send']:['read','write'];
 if(normalized.some(s=>!allowed.includes(s))||required.some(s=>!normalized.includes(s)))throw Error('connected_action_scope_insufficient');return [...scopes];
}
