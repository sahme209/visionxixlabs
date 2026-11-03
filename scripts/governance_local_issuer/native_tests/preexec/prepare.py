"""Compile only. Never launches the bootstrap, Node or fixture addon."""
from pathlib import Path
import hashlib,json,os,shutil,subprocess,tempfile
source=Path(__file__).resolve().parent
build=Path(tempfile.mkdtemp(prefix='axiom-preexec-prepared-',dir='/private/tmp'));build.chmod(0o700)
node=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node').resolve(strict=True)
headers=node.parent.parent/'include/node'
for name in ('bootstrap.c','fixture.c','fixture.cjs','run_reviewed.py'):shutil.copyfile(source/name,build/name)
commands=[['/usr/bin/xcrun','clang','-std=c11','-Wall','-Wextra','-Werror','-Wno-deprecated-declarations','-O1',f'-DFIXED_NODE="{node}"',f'-DFIXED_SCRIPT="{build}/fixture.cjs"',str(build/'bootstrap.c'),'-o',str(build/'bootstrap')],['/usr/bin/xcrun','clang','-std=c11','-Wall','-Wextra','-Werror','-O1','-bundle','-undefined','dynamic_lookup',f'-I{headers}',str(build/'fixture.c'),'-o',str(build/'fixture.node')]]
for command in commands:subprocess.run(command,check=True,capture_output=True,timeout=30)
for p in build.iterdir():p.chmod(0o600)
hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in build.iterdir() if p.is_file()}
manifest={'scope':'PREPARATION_ONLY_NO_EXECUTION','node':str(node),'node_sha256':hashlib.sha256(node.read_bytes()).hexdigest(),'artifact_root':str(build),'files':hashes,'compile_commands':commands,'run_argv':['/usr/bin/python3',str(build/'run_reviewed.py'),'--run-exact-reviewed-preexec-fixture'],'children':2,'child_timeout_seconds':15,'provider_io':False,'profile_runs_so_far':0,'identity':'unavailable'}
(build/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');(build/'manifest.json').chmod(0o600)
print(json.dumps({'prepared':str(build),'manifest_sha256':hashlib.sha256((build/'manifest.json').read_bytes()).hexdigest(),'execution':False}))
