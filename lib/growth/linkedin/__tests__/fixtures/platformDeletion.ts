import {compilePlatformPlan,createPlatformAction,approvePlatformAction,claimPlatformAction,finishPlatformAction} from '@/lib/governance/platform/kernel';
const now=Date.parse('2026-11-12T00:00:00Z'),d='a'.repeat(64),requester={userId:'one',sessionId:'one-session'},reviewer={userId:'two',sessionId:'two-session'};
export function deletionFixture(){
 const connection={id:'connection',linkedinUrn:'urn:li:person:author',organizationUrn:null,scopes:'w_member_social',status:'connected',expiresAt:new Date(now+60000),updatedAt:new Date(now-1000)};
 const plan=compilePlatformPlan({format:1,scope:'platform',sourceDigest:d,expiresAt:new Date(now+60000).toISOString(),effects:[{id:'publish',kind:'growth.post.publish',target:{draftId:'draft',connectionId:'connection',connectionRevision:d,author:connection.linkedinUrn,renderedPayloadDigest:d}}]});
 const proposed=createPlatformAction(plan,requester,now-400),approved=approvePlatformAction(proposed,{...reviewer,planDigest:plan.digest},now-300),claimed=claimPlatformAction(approved,requester,now-200),action=finishPlatformAction(claimed,'confirmed',now-100);
 return {draft:{id:'draft',status:'published',linkedinPostUrn:'urn:li:share:123',updatedAt:new Date(now-50)},connection,publication:{actionId:'platform_action_11111111-1111-4111-8111-111111111111',state:action,outcome:'success',postUrn:'urn:li:share:123'}};
}
