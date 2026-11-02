"""Fresh private PostgreSQL composition fixture; never reads a remote DB URL."""
import os, re, shutil, subprocess, tempfile
from pathlib import Path
os.umask(0o077)
repo=Path(__file__).resolve().parents[2]
root=Path(tempfile.mkdtemp(prefix='axiom-native-git-lease-pg-',dir='/private/tmp')).resolve()
socket=root/'socket';socket.mkdir(mode=0o700)
(root/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
(root/'package.json').write_text('{}')
bins=Path('/opt/homebrew/opt/postgresql@17/bin')
node=shutil.which('node')
if not node: raise RuntimeError('local Node required')
env={key:os.environ[key] for key in ['PATH','HOME'] if key in os.environ}
env.update(PRISMA_GENERATE_SKIP_AUTOINSTALL='true',LANG='C',TZ='UTC',PGHOST=str(socket),PGUSER='native_git_fixture',PGDATABASE='native_git_fixture')
def run(args):
 result=subprocess.run([str(arg) for arg in args],env=env,cwd=repo,capture_output=True,text=True,timeout=90)
 if result.returncode:
  print(result.stdout+result.stderr)
  raise RuntimeError(str(args[0])+' failed')
 return result.stdout
started=False
try:
 run([bins/'initdb','-D',root/'data','-U','native_git_fixture','--locale=C','--encoding=UTF8','--auth-local=trust','--auth-host=reject'])
 run([bins/'pg_ctl','-D',root/'data','-l',root/'server.log','-o',"-k "+str(socket)+" -c listen_addresses='' -c unix_socket_permissions=0700",'-w','start']);started=True
 run([bins/'createdb','-w','native_git_fixture'])
 source=(repo/'prisma/schema.prisma').read_text()
 models=[re.search(r'^model '+name+r' \{.*?^\}',source,re.S|re.M).group() for name in ['DurableAgentWorkflow','DurableAgentWorkflowEvent']]
 header='''generator client {
 provider = "prisma-client-js"
 output = "./generated"
}
datasource db {
 provider = "postgresql"
 url = env("DATABASE_URL")
}
'''
 models.append('''model OrgMembership {
 id String @unique @default(cuid())
 organizationId String
 userId String
 role String
 acceptedAt DateTime?
 @@id([organizationId,userId])
}
model DesktopSessionRecord {
 id String @id
 organizationId String
 userId String
 revokedAt DateTime?
 expiresAt DateTime
}
model GitHubInstallation {
 id String @id
 organizationId String
 githubInstallationId String
 accountLogin String
 installedAt DateTime @default(now())
 status String
 updatedAt DateTime
 revokedAt DateTime?
 suspendedAt DateTime?
}
''')
 schema=root/'schema.prisma';schema.write_text(header+'\n'.join(models))
 env['DATABASE_URL']='postgresql://native_git_fixture@localhost/native_git_fixture?host='+str(socket).replace('/','%2F')
 run([node,'node_modules/prisma/build/index.js','generate','--schema',schema])
 run([node,'node_modules/prisma/build/index.js','db','push','--schema',schema,'--skip-generate'])
 env['AXIOM_NATIVE_GIT_COMPOSITION_SOCKET']=str(socket)
 env['AXIOM_NATIVE_GIT_COMPOSITION_CLIENT']=str(root/'generated/index.js')
 print(run([node,'scripts/run-vitest.mjs','lib/desktop/__tests__/nativeGitCredentialLeaseComposition.pg.test.ts']))
finally:
 if started: print(run([bins/'pg_ctl','-D',root/'data','-m','fast','-w','stop']))
 print('Owned fixture:',root)
