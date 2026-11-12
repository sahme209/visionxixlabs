import {z} from 'zod';
import {digest,platformCustodianRoleArn} from '../contracts';
const revision=z.number().int().nonnegative().max(2147483647);
const custodian=z.object({accountId:z.string().regex(/^\d{12}$/),roleArn:platformCustodianRoleArn}).strict().refine(v=>v.roleArn.startsWith('arn:aws:iam::'+v.accountId+':role/'));
const base={format:z.literal(1),scope:z.literal('platform'),custodian,issuerProfileDigest:digest,sourceEvidenceDigest:digest,predecessorAdmissionDigest:digest,expectedGeneration:revision,expectedVersion:revision.nullable(),expiresAt:z.string().max(40).datetime()};
export const custodianDrainSelection=z.discriminatedUnion('operation',[
 z.object({...base,operation:z.literal('begin')}).strict(),
 z.object({...base,operation:z.literal('abort'),restoredAdmissionDigest:digest}).strict(),
]).superRefine((v,c)=>{
 if((v.expectedGeneration===0)!==(v.expectedVersion===null))c.addIssue({code:'custom',message:'generation and version must identify the same original barrier'});
 if(v.operation==='abort'&&(v.expectedGeneration===0||v.restoredAdmissionDigest!==v.predecessorAdmissionDigest))c.addIssue({code:'custom',message:'abort must restore only its exact predecessor'});
});
