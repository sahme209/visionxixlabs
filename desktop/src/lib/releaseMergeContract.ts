export type ReleaseMergeMethod='merge'|'squash'|'rebase';
export interface ReleaseMergeTargets {requestId:string;requestVersion:number;repositoryFullName:string;targets:Array<{number:number;url:string}>}
export interface ReleaseMergePlanEvidence {
 authority:'evidence_only';digest:string;
 plan:{kind:'merge_pull_request';organizationId:string;requestId:string;requestVersion:number;intakeDigest:string;connectionId:string;connectionRevision:string;window:{startUtc:string;endUtc:string};method:ReleaseMergeMethod;pullRequest:{repositoryFullName:string;number:number;url:string;headRef:string;headSha:string;baseRef:string;baseSha:string}};
}
const object=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
const keys=(v:Record<string,unknown>,names:string[])=>Object.keys(v).length===names.length&&Object.keys(v).every(k=>names.includes(k));
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=240&&v===v.trim()&&!/[\0\r\n]/.test(v);
const repository=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(v);
const hash=(v:unknown,n:number)=>typeof v==='string'&&new RegExp(`^[a-f0-9]{${n}}$`).test(v);
const instant=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
export function isReleaseMergeTargets(value:unknown,requestId:string,version:number):value is ReleaseMergeTargets{
 const v=object(value);if(!v||!keys(v,['requestId','requestVersion','repositoryFullName','targets'])||v.requestId!==requestId||v.requestVersion!==version||!repository(v.repositoryFullName)||!Array.isArray(v.targets)||!v.targets.length||v.targets.length>25)return false;
 const seen=new Set<number>();
 return v.targets.every(raw=>{const t=object(raw);if(!t||!keys(t,['number','url'])||!Number.isSafeInteger(t.number)||(t.number as number)<1||t.url!==`https://github.com/${v.repositoryFullName}/pull/${t.number}`||seen.has(t.number as number))return false;seen.add(t.number as number);return true});
}
export function isReleaseMergePlanEvidence(value:unknown,requestId:string,version:number,number:number,method:ReleaseMergeMethod,repositoryFullName:string):value is ReleaseMergePlanEvidence{
 const v=object(value),p=object(v?.plan),w=object(p?.window),pr=object(p?.pullRequest);
 return !!(v&&p&&w&&pr&&keys(v,['authority','digest','plan'])&&v.authority==='evidence_only'&&hash(v.digest,64)
  &&keys(p,['kind','organizationId','requestId','requestVersion','intakeDigest','connectionId','connectionRevision','window','method','pullRequest'])
  &&p.kind==='merge_pull_request'&&p.requestId===requestId&&p.requestVersion===version&&p.method===method&&text(p.organizationId)&&hash(p.intakeDigest,64)&&text(p.connectionId)&&instant(p.connectionRevision)
  &&keys(w,['startUtc','endUtc'])&&instant(w.startUtc)&&instant(w.endUtc)&&Date.parse(w.startUtc)<Date.parse(w.endUtc)
  &&keys(pr,['repositoryFullName','number','url','headRef','headSha','baseRef','baseSha'])&&repository(pr.repositoryFullName)&&pr.repositoryFullName===repositoryFullName&&pr.number===number&&pr.url===`https://github.com/${repositoryFullName}/pull/${number}`&&text(pr.headRef)&&text(pr.baseRef)&&hash(pr.headSha,40)&&hash(pr.baseSha,40));
}
