import {it,expect} from 'vitest';
import {imageWorkflowCommand,imageWorkflowPreview} from '../imageWorkflowContract';
it('allows exact image intake/recovery/review commands without caller authority, file paths or native destination',()=>{
 const requestReference='11111111-1111-4111-8111-111111111111',c={operation:'intake',connectionId:'connection',mimeType:'image/png',requestReference,bytesBase64url:'AQ'};
 expect(imageWorkflowCommand.parse(c)).toEqual(c);
 for(const extra of [{creatorUserId:'invented'},{qualified:true},{uploadUrl:'https://private.invalid'},{path:'/tmp/image'}])expect(imageWorkflowCommand.safeParse({...c,...extra}).success).toBe(false);
 for(const bytesBase64url of ['A','AR','AA=','AA+','AA/','http://image','AQ\n'])expect(imageWorkflowCommand.safeParse({...c,bytesBase64url}).success).toBe(false);
 expect(imageWorkflowCommand.safeParse({operation:'execute',actionId:'platform_action_'+requestReference}).success).toBe(false);
 expect(imageWorkflowCommand.parse({operation:'lookup_artifact',requestReference})).toEqual({operation:'lookup_artifact',requestReference});
});
it('does not accept a private preview object, session, envelope or caller execution authority as a public preview',()=>{
 for(const value of [{state:{},binding:{},bytes:new Uint8Array(1),actors:[]},{action:{},envelope:'v2.private',authority:'private_image_review_source_only'},{executionAuthorized:true}])expect(imageWorkflowPreview.safeParse(value).success).toBe(false);
});
it('rejects a one-effect historical image plan as a normal validation failure instead of dereferencing a missing PUT',()=>{
 const d='a'.repeat(64),target={connectionId:'connection',connectionRevision:d,author:'urn:li:person:author',bytesDigest:d},effect={id:'initialize',kind:'growth.image.initialize',target};
 const value={action:{actionId:'platform_action_11111111-1111-4111-8111-111111111111',version:0,status:'proposed',attemptCount:0,requesterUserId:'requester',reviewerUserId:null,plan:{format:1,scope:'platform',sourceDigest:d,expiresAt:'2030-01-01T00:00:00.000Z',effects:[effect],digest:d},expired:false,effects:[{id:'initialize',status:'not_started'}],authority:'history_only',sourceValidation:'not_checked'},artifact:{artifactId:'platform_image_artifact_11111111-1111-4111-8111-111111111111',creatorUserId:'requester',...target,byteCount:1,mimeType:'image/png',width:1,height:1,formatProfileDigest:d},bindingDigest:d,bytesBase64url:'AQ',authority:'review_preview_only',executionAuthorized:false};
 expect(()=>imageWorkflowPreview.safeParse(value)).not.toThrow();expect(imageWorkflowPreview.safeParse(value).success).toBe(false);
});
it('accepts only the exact versioned image execution steps, never a destination or invented observation',()=>{
 const actionId='platform_action_11111111-1111-4111-8111-111111111111',planDigest='a'.repeat(64);
 for(const [operation,expectedVersion] of [['initialize',1],['put',2]] as const){const command={operation,actionId,expectedVersion,planDigest};expect(imageWorkflowCommand.safeParse(command).success).toBe(true);for(const fields of [{uploadUrl:'https://private.invalid'},{qualified:true},{outcome:'confirmed'},{expectedVersion:0}])expect(imageWorkflowCommand.safeParse({...command,...fields}).success).toBe(false)}
});
