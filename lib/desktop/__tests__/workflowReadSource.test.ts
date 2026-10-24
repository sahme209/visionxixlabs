import {expect,it} from 'vitest';
import {singleGithubRepository,workflowFilePath} from '../../../desktop/src/lib/workflowReadSource';
it.each(['https://github.com/acme/app','https://github.com/acme/app.git','https://github.com/acme/app/'])('resolves one exact repository URL: %s',url=>expect(singleGithubRepository(url)).toBe('acme/app'));
it.each(['https://github.com/acme/app,https://github.com/other/app','https://user:secret@github.com/acme/app','https://github.com/acme/app?token=secret','https://outside.invalid/acme/app','https://github.com/acme/app/tree/main','http://github.com/acme/app'])('does not guess from ambiguous or unsafe source: %s',url=>expect(singleGithubRepository(url)).toBe(''));
it('normalizes a filename without accepting arbitrary provider URLs',()=>{expect(workflowFilePath('deploy.yml')).toBe('.github/workflows/deploy.yml');expect(workflowFilePath('.github/workflows/deploy.yaml')).toBe('.github/workflows/deploy.yaml');expect(workflowFilePath('https://outside.invalid/deploy.yml')).toBe('');expect(workflowFilePath('../deploy.yml')).toBe('')});

it('preserves only observations matching the complete current source',async()=>{
 const {matchingWorkflowObservation}=await import('../../../desktop/src/lib/workflowReadSource');
 const source={repositoryFullName:'team/app',ref:'main',path:'.github/workflows/release.yml',blobSha:'a'.repeat(40)};
 expect(matchingWorkflowObservation(source,'team/app','main',source.path)).toEqual(source);
 expect(matchingWorkflowObservation(source,'team/other','main',source.path)).toBeUndefined();
 expect(matchingWorkflowObservation(source,'team/app','other',source.path)).toBeUndefined();
 expect(matchingWorkflowObservation(source,'team/app','main','.github/workflows/other.yml')).toBeUndefined();
 expect(matchingWorkflowObservation({...source,blobSha:'bad'},'team/app','main',source.path)).toBeUndefined();
});
