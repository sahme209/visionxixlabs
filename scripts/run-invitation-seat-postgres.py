import os, subprocess, tempfile
from pathlib import Path
os.umask(0o077)
repo=Path.cwd();root=Path(tempfile.mkdtemp(prefix='axiom-invitation-seat-pg-',dir='/private/tmp')).resolve();socket=root/'socket';socket.mkdir(mode=0o700)
(root/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True);(root/'package.json').write_text('{}')
bins=Path('/opt/homebrew/opt/postgresql@17/bin');node='/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node'
env={k:os.environ[k] for k in ['PATH','HOME'] if k in os.environ};env.update(LANG='C',TZ='UTC',PGHOST=str(socket),PGUSER='invite_fixture',PGDATABASE='invite_fixture',PRISMA_GENERATE_SKIP_AUTOINSTALL='true')
def run(args):
 r=subprocess.run([str(x) for x in args],env=env,cwd=repo,capture_output=True,text=True,timeout=90)
 if r.returncode:print(r.stdout+r.stderr);raise RuntimeError(str(args[0])+' failed')
 return r.stdout
started=False
try:
 run([bins/'initdb','-D',root/'data','-U','invite_fixture','--locale=C','--encoding=UTF8','--auth-local=trust','--auth-host=reject'])
 run([bins/'pg_ctl','-D',root/'data','-l',root/'server.log','-o',"-k "+str(socket)+" -c listen_addresses='' -c unix_socket_permissions=0700",'-w','start']);started=True
 run([bins/'createdb','-w','invite_fixture'])
 schema=root/'schema.prisma';schema.write_text('''generator client {
 provider = "prisma-client-js"
 output = "./generated"
}
datasource db {
 provider = "postgresql"
 url = env("DATABASE_URL")
}
model OrgMembership {
 id String @id @default(cuid())
 userId String
 organizationId String
 role String
 acceptedAt DateTime?
 invitedBy String?
 @@unique([userId, organizationId])
}
model TenantBillingPlan {
 organizationId String @id
 tier String
 status String
 seatQuantity Int?
}
''')
 env['DATABASE_URL']='postgresql://invite_fixture@localhost/invite_fixture?host='+str(socket).replace('/','%2F')
 run([node,'node_modules/prisma/build/index.js','generate','--schema',schema]);run([node,'node_modules/prisma/build/index.js','db','push','--schema',schema,'--skip-generate'])
 env['AXIOM_INVITATION_SEAT_PG_SOCKET']=str(socket);env['AXIOM_INVITATION_SEAT_PG_CLIENT']=str(root/'generated/index.js')
 print(run([node,'node_modules/vitest/vitest.mjs','run','lib/billing/__tests__/invitationSeatClaim.pg.test.ts']))
finally:
 if started:print(run([bins/'pg_ctl','-D',root/'data','-m','fast','-w','stop']))
 print('Owned fixture:',root)
