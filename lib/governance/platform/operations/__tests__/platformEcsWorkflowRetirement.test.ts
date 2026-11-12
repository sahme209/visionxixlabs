import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {parse} from 'yaml';
import {spawnSync} from 'node:child_process';
it('denies the actual Axiom repository ECS workflow before workload token or native operations',()=>{
 const workflow=parse(readFileSync('.github/workflows/axiom-deploy-aws-ecs.yml','utf8'));
 expect(workflow.permissions).toEqual({});expect(Object.keys(workflow.jobs)).toEqual(['deploy']);
 const job=workflow.jobs.deploy;expect(job['runs-on']).toBe('ubuntu-latest');expect(job.permissions).toBeUndefined();expect(job.env).toBeUndefined();expect(job.steps).toHaveLength(1);
 const step=job.steps[0];expect(step.uses).toBeUndefined();expect(step.env).toBeUndefined();expect(step.run).not.toMatch(/\$\{|\baws\b|curl|fetch|configure-aws|wait services/);
 const result=spawnSync('/bin/bash',['-euo','pipefail','-c',step.run],{env:{PATH:'/usr/bin:/bin',NODE_ENV:'test'},encoding:'utf8',timeout:3000});expect(result.status).toBe(1);expect(result.stdout).toContain('Axiom managed deployment review is required');expect(result.stdout).toContain('No credential or provider action was performed');expect(result.stderr).toBe('');
});
