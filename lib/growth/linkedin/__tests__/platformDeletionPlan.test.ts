import {it,expect} from 'vitest';
import {preparePlatformLinkedInDeletion} from '../platformDeletionPlan';
import {deletionFixture as fixture} from './fixtures/platformDeletion';
const now=Date.parse('2026-11-12T00:00:00Z');
it('binds exact recorded publication, draft revision, current account and delete version',()=>{
 const f=fixture(),p=preparePlatformLinkedInDeletion(f,'202605',now);expect(p.effect.target).toMatchObject({draftId:'draft',postUrn:'urn:li:share:123',connectionId:'connection',author:f.connection.linkedinUrn,apiVersion:'202605',publicationActionId:f.publication.actionId});
 expect(preparePlatformLinkedInDeletion({...f,draft:{...f.draft,updatedAt:new Date(now)}},'202605',now).effect).not.toEqual(p.effect);
});
it('unknown history, mismatched post/author and untrusted account cannot authorize deletion',()=>{
 const f=fixture();
 for(const source of [ {...f,publication:{...f.publication,outcome:'unknown'}},{...f,publication:{...f.publication,postUrn:'urn:li:share:other'}},{...f,publication:{...f.publication,state:{...f.publication.state,status:'unknown'}}},{...f,connection:{...f.connection,linkedinUrn:'urn:li:person:other'}},{...f,connection:{...f.connection,status:'revoked'}},{...f,draft:{...f.draft,status:'approved'}}])expect(()=>preparePlatformLinkedInDeletion(source,'202605',now)).toThrow();
});
