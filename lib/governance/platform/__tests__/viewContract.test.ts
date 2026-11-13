import {it,expect} from 'vitest';
import {platformInspectionSchema} from '../viewContract';
import {compilePlatformPlan} from '../kernel';
const d='a'.repeat(64);
export function inspection(){return {actionId:'platform_action_11111111-1111-4111-8111-111111111111',version:0,status:'proposed',attemptCount:0,requesterUserId:'requester',reviewerUserId:null,plan:compilePlatformPlan({format:1,scope:'platform',sourceDigest:d,expiresAt:'2026-11-13T00:00:00Z',effects:[{id:'one',kind:'settings.vercel',target:{projectId:'project',settingsDigest:d}}]}),expired:false,effects:[{id:'one',status:'not_started'}],authority:'history_only',sourceValidation:'not_checked'}}
it('accepts only exact bounded history DTOs without session/capability fields',()=>{
 const good=inspection();expect(platformInspectionSchema.safeParse(good).success).toBe(true);
 for(const bad of [{...good,sessionId:'not-public'},{...good,authority:'execution_approved'},{...good,effects:[{id:'other',status:'not_started'}]},{...good,status:'confirmed',attemptCount:1,reviewerUserId:'reviewer',version:3}])expect(platformInspectionSchema.safeParse(bad).success).toBe(false);
});
