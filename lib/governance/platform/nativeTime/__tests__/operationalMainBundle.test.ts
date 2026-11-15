import {expect,it} from 'vitest';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

it('keeps the real closed compiler and filesystem replacement checks in ordinary CI',()=>{
  const result=spawnSync(process.execPath,['--test',path.resolve('scripts/tests/test_operational_private_main_bundle.mjs')],{
    cwd:process.cwd(),encoding:'utf8',timeout:30000,maxBuffer:1024*1024,
  });
  expect(result.error).toBeUndefined();
  expect(result.status,result.stdout+'\n'+result.stderr).toBe(0);
});
