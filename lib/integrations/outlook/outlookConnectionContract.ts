import 'server-only';
import {createHash} from 'node:crypto';
import {z} from 'zod';
export const OUTLOOK_READ_SCOPES=['openid','offline_access','User.Read','Mail.ReadBasic','Calendars.Read'] as const;
export const OUTLOOK_ACTION_SCOPES=['openid','offline_access','User.Read','Mail.ReadBasic','Calendars.Read','Mail.Send','Calendars.ReadWrite'] as const;
export const outlookPurposeSchema=z.enum(['read','actions']);export type OutlookPurpose=z.infer<typeof outlookPurposeSchema>;
const opaque=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x20\x7f-\x9f]/.test(v));
export const outlookAccountSchema=z.object({id:opaque,displayName:z.string().max(240),email:z.string().email().max(320).nullable()}).strict();
const normalize=(scope:string)=>scope.replace(/^https:\/\/graph\.microsoft\.com\//i,'').toLowerCase();
/** Validate exact reported authority, never manufacture omitted scopes or treat Teams consent as mail access. */
export function validateOutlookScopes(purpose:OutlookPurpose,raw:unknown):string[]{
 outlookPurposeSchema.parse(purpose);const scopes=z.array(opaque).min(1).max(20).parse(raw),normalized=scopes.map(normalize);
 const allowed=[...(purpose==='read'?OUTLOOK_READ_SCOPES:OUTLOOK_ACTION_SCOPES),'profile','email'].map(normalize),required=purpose==='read'?['user.read','mail.readbasic','calendars.read']:['user.read','mail.readbasic','mail.send','calendars.readwrite'];
 if(new Set(normalized).size!==normalized.length||normalized.some(s=>!allowed.includes(s))||required.some(s=>!normalized.includes(s)))throw Error('outlook_scope_insufficient');return [...scopes];
}
export const outlookAuthoritySchema=z.union([z.enum(['common','organizations','consumers']),z.string().uuid()]);
const authorizationSchema=z.object({authority:outlookAuthoritySchema,clientId:z.string().uuid(),redirectUri:z.literal('https://visionxixlabs.com/api/integrations/outlook/callback'),state:z.string().regex(/^[A-Za-z0-9_-]{43,256}$/),verifier:z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),purpose:outlookPurposeSchema}).strict();
export function buildOutlookAuthorization(raw:unknown):string{
 const input=authorizationSchema.parse(raw),url=new URL(`https://login.microsoftonline.com/${input.authority}/oauth2/v2.0/authorize`);
 url.search=new URLSearchParams({client_id:input.clientId,response_type:'code',redirect_uri:input.redirectUri,response_mode:'query',prompt:'select_account',scope:(input.purpose==='read'?OUTLOOK_READ_SCOPES:OUTLOOK_ACTION_SCOPES).join(' '),code_challenge:createHash('sha256').update(input.verifier).digest('base64url'),code_challenge_method:'S256',state:input.state}).toString();return url.toString();
}
const secret=z.string().min(1).max(32768).refine(v=>!/[\x00-\x20\x7f-\x9f]/.test(v));
export const outlookCredentialSchema=z.object({purpose:z.enum(['outlook_read_v1','outlook_actions_v1']),accessToken:secret,refreshToken:secret.nullable(),expiresAt:z.number().int().safe().positive(),account:outlookAccountSchema,scopes:z.array(opaque).min(1).max(20)}).strict().superRefine((v,c)=>{try{validateOutlookScopes(v.purpose==='outlook_read_v1'?'read':'actions',v.scopes)}catch{c.addIssue({code:'custom',message:'Outlook credential purpose does not match its granted scopes'})}});
export type OutlookCredential=z.infer<typeof outlookCredentialSchema>;
export const parseOutlookCredential=(input:unknown):OutlookCredential=>outlookCredentialSchema.parse(input);
export const outlookConnectionBindingSchema=z.object({organizationId:opaque,connectionId:opaque,connectionRevision:z.string().datetime(),accountId:opaque,consentedByUserId:opaque}).strict();
export type OutlookConnectionBinding=z.infer<typeof outlookConnectionBindingSchema>;
