import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {expect,it} from 'vitest';

it('runs actual private journal and claim regressions on isolated synthetic files only',()=>{
 const root=fileURLToPath(new URL('../../../../../',import.meta.url));
 const result=spawnSync('/usr/bin/python3',['scripts/tests/test_governance_original_attempt.py'],{
  cwd:root,encoding:'utf8',timeout:15_000,maxBuffer:64*1024,
  env:{NODE_ENV:'test',PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',PYTHONDONTWRITEBYTECODE:'1'},
 });
 expect(result.error, result.error?.message).toBeUndefined();
 expect(result.status, result.stdout+'\n'+result.stderr).toBe(0);
 expect(result.stderr).toContain('Ran 38 tests');
 expect(result.stderr.trim().endsWith('OK')).toBe(true);
});
