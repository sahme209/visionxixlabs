import importlib.util,json,sys,tempfile,traceback
from pathlib import Path
repo=Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion')
sys.path.insert(0,str(repo/'scripts'))
def load(name,file):
 spec=importlib.util.spec_from_file_location(name,repo/'scripts'/file);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
b=load('website_builder_3bfae851','build-local-issuer-package-source.py');e=load('local_engines_3bfae851','local_prisma_engine_inputs.py')
rev='3bfae851aa17046db316b3408d687fe89e0a4e07';node=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node');cache=Path.home()/'.npm/_cacache'
owned=Path(tempfile.mkdtemp(prefix='axiom-website-3bfae851-',dir='/private/tmp'))
Path('/private/tmp/axiom-website-3bfae851-coordinates.json').write_text(json.dumps({'owned':str(owned),'sourceRevision':rev}))
print('OWNED',owned,flush=True)
phase='preparation'
try:
 prep=b.prepare_optional_probe(repo,rev,cache,node,node.parent.parent/'lib/node_modules/npm/bin/npm-cli.js',owned)
 (owned/'preparation.json').write_text(json.dumps(prep,sort_keys=True));print('PREPARATION_PASS',flush=True)
 phase='binding'
 binding=e.bind_local_engines(Path.home()/'.cache/prisma/master'/e.REQUESTED_COMMIT/'darwin-arm64',owned)
 (owned/'binding.json').write_text(json.dumps(binding,sort_keys=True));phase='generation'
 gen=owned/'generation-run';gen.mkdir(mode=0o700)
 e.execute_generation(owned/'stage',owned/'engine-inputs',repo,rev,cache,node,gen);print('GENERATION_PASS',flush=True)
 phase='build';build=owned/'build-run';build.mkdir(mode=0o700)
 result=b.execute_build(owned/'stage',repo,rev,cache,owned/'engine-inputs',gen,node,build)
 (owned/'terminal-summary.json').write_text(json.dumps({'sourceRevision':rev,'phase':phase,'status':result['status'],'buildOutputsVerified':result['buildOutputsVerified'],'executionAuthorized':False}))
 print('BUILD_RESULT',json.dumps({'status':result['status'],'buildOutputsVerified':result['buildOutputsVerified'],'executionAuthorized':False}),flush=True)
except BaseException as exc:
 (owned/'terminal-summary.json').write_text(json.dumps({'sourceRevision':rev,'phase':phase,'status':'failed','errorType':type(exc).__name__,'error':str(exc),'executionAuthorized':False}))
 raise
