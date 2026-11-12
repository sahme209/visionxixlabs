import {z} from 'zod';
export const platformSourceKind=z.enum(['drafts','accounts']);
export type PlatformSourceKind=z.infer<typeof platformSourceKind>;
export const platformSourceId=z.string().min(1).max(256).refine(v=>v===v.trim()&&!/[\x00-\x1f]/.test(v));
export const platformSourceCommand=z.object({operation:z.literal('list_sources'),kind:platformSourceKind,cursor:platformSourceId.nullable()}).strict();
const metadata={id:platformSourceId,label:z.string().max(240),labelTruncated:z.boolean(),status:z.string().min(1).max(100),updatedAt:z.string().datetime()};
const draft=z.object(metadata).strict(),account=z.object({...metadata,author:platformSourceId,expiresAt:z.string().datetime()}).strict();
const common={nextCursor:platformSourceId.nullable(),authority:z.literal('selection_metadata_only')};
export const platformSourcePage=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('drafts'),entries:z.array(draft).max(20),...common}).strict(),
 z.object({kind:z.literal('accounts'),entries:z.array(account).max(20),...common}).strict(),
]).superRefine((page,c)=>{
 const fail=()=>c.addIssue({code:'custom',message:'Invalid source selection page'});let previous:string|null=null;
 for(const e of page.entries){if(previous!==null&&e.id>=previous)fail();previous=e.id}
 if(page.nextCursor&&(page.entries.length!==20||page.nextCursor!==previous))fail();
});
export type PlatformSourcePage=z.infer<typeof platformSourcePage>;
/** Projection accepts only explicitly selected metadata. Never a source preview,
 * credential, posting entitlement or authority to create an execution plan. */
export function projectPlatformSources(kind:PlatformSourceKind,raw:unknown,cursor:string|null){
 const dates={updatedAt:z.date()},schema=kind==='drafts'?draft.extend(dates):account.extend({...dates,expiresAt:z.date()});
 const rows=z.array(schema).max(21).parse(raw);let previous=cursor;
 const entries=rows.map(row=>{
  if(previous!==null&&row.id>=previous)throw Error('platform_sources_unavailable');previous=row.id;
  return {...row,updatedAt:row.updatedAt.toISOString(),...('expiresAt' in row?{expiresAt:z.date().parse(row.expiresAt).toISOString()}:{})};
 });
 return platformSourcePage.parse({kind,entries:entries.slice(0,20),nextCursor:entries.length===21?entries[19].id:null,authority:'selection_metadata_only'});
}
