import importlib.util,json,hashlib,os,traceback
from pathlib import Path
root=Path(__file__).parent
repo=Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion')
rev='e146877a65603d88ed51d35c80fd2caeeccbdf2d'
cache=Path('/Users/samirahmed/.npm/_cacache')
node=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
def load(name,file,expected):
 p=repo/'scripts'/file
 assert hashlib.sha256(p.read_bytes()).hexdigest()==expected
 s=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def save(name,data):(root/name).write_text(json.dumps(data,sort_keys=True)+'\n')
print('OWNED',root,'PID',os.getpid(),flush=True)
try:
 b=load('builder','build-local-issuer-package-source.py','c099c90b95778062873ed4b17546d84c915f707fdaa4c5399b4938e5f31cb2a1')
 e=load('engines','local_prisma_engine_inputs.py','6def73deece943de43643b385d83321abdbfcdd17c59eb48f84eeb647293fb2f')
 package,lock,src=b.source_inputs(repo,rev)
 assert src['packageSha256']=='3f484e77eedd0eede93df152b8c1c4fedd139072b72dfa52957257d8d5a2e4d1'
 assert src['lockSha256']=='472bd3b6cabeca9129214fd58f3caf104a973cce0332d2ad3b29d82a8fa86775'
 save('source-inputs.json',src)
 prep=b.prepare_optional_probe(repo,rev,cache,node,node.parent.parent/'lib/node_modules/npm/bin/npm-cli.js',root)
 save('preparation.json',prep)
 assert prep['npmOutcome']=='succeeded'
 print('PREPARATION_PASS',flush=True)
 binding=e.bind_local_engines(Path('/Users/samirahmed/.cache/prisma/master/605197351a3c8bdd595af2d2a9bc3025bca48ea2/darwin-arm64'),root)
 save('binding.json',binding)
 (root/'generation-run').mkdir(mode=0o700)
 result=e.execute_generation(root/'stage',root/'engine-inputs',repo,rev,cache,node,root/'generation-run',timeout=120)
 assert result['generatedOutputsVerified'],result
 print('GENERATION_PASS',flush=True)
 (root/'build-run').mkdir(mode=0o700)
 print('BUILD_START',flush=True)
 result=b.execute_build(stage=root/'stage',repo=repo,revision=rev,cache=cache,bound_dir=root/'engine-inputs',generation_run=root/'generation-run',node=node,owned=root/'build-run',timeout=600)
 save('terminal-summary.json',result)
 print('BUILD_RESULT',json.dumps(result),flush=True)
 assert result['buildOutputsVerified'],result
except BaseException:
 traceback.print_exc();raise
