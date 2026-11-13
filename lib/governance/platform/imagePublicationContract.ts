import {z} from 'zod';
import {digest} from './contracts';
import {platformActionId} from './viewContract';
const id=z.string().min(1).max(256);
export const imagePublicationLineageBody=z.object({format:z.literal(1),purpose:z.literal('platform_image_publication_lineage_v1'),uploadActionId:platformActionId,uploadPlanDigest:digest,bindingDigest:digest,artifactId:z.string().regex(/^platform_image_artifact_[a-f0-9-]{36}$/),bytesDigest:digest,connectionId:id,connectionRevision:id,author:z.string().max(512).regex(/^urn:li:(?:person|organization):[A-Za-z0-9_-]+$/),providerImageReference:z.string().max(512).regex(/^urn:li:image:[A-Za-z0-9_-]+$/),grantReference:z.string().regex(/^platform_image_grant_[a-f0-9]{64}$/),putReceiptDigest:digest}).strict();
export const imagePublicationLineagePublic=imagePublicationLineageBody.extend({lineageDigest:digest}).strict();
