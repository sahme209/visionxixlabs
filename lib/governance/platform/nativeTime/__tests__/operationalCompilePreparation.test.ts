import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {expect,it} from 'vitest';

it('checks the closed compiler controller with synthetic inputs and no native process',()=>{
 const root=fileURLToPath(new URL('../../../../../',import.meta.url));
 const result=spawnSync('/usr/bin/python3',['scripts/tests/test_governance_operational_compile.py'],{
  cwd:root,encoding:'utf8',timeout:15_000,maxBuffer:64*1024,
  env:{NODE_ENV:'test',PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',PYTHONDONTWRITEBYTECODE:'1'},
 });
 expect(result.error,result.error?.message).toBeUndefined();
 expect(result.status,result.stdout+'\n'+result.stderr).toBe(0);
 expect(result.stderr).toMatch(/Ran [0-9]+ tests/);
 expect(result.stderr.trim().endsWith('OK')).toBe(true);
});
