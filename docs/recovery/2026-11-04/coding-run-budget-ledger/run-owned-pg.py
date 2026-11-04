"""Owned socket-only budget fixture. No inherited application environment."""
import os, pathlib, subprocess, tempfile, json, urllib.parse
os.umask(0o077)
evidence=pathlib.Path('/private/tmp/axiom-a7-run-budget-evidence')
repo=pathlib.Path('/private/tmp/axiom-a7-run-budget-20261104')
root=pathlib.Path(tempfile.mkdtemp(prefix='axiom-budget-pg-',dir='/private/tmp')).resolve()
socket=root/'socket';socket.mkdir(mode=0o700)
bins=pathlib.Path('/opt/homebrew/opt/postgresql@17/bin')
node=pathlib.Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
url='postgresql://budget_fixture@localhost:55439/axiom_budget_fixture?host='+urllib.parse.quote(str(socket),safe='')
env={'PATH':str(node.parent)+':/usr/bin:/bin','HOME':str(evidence),'TMPDIR':str(root),'LANG':'C','TZ':'UTC','NODE_ENV':'test','DATABASE_URL':url,'PGHOST':str(socket),'PGPORT':'55439','PGUSER':'budget_fixture','PGDATABASE':'axiom_budget_fixture','PRISMA_SCHEMA_ENGINE_BINARY':str(evidence/'engines/schema-engine'),'PRISMA_QUERY_ENGINE_LIBRARY':str(evidence/'engines/libquery_engine-darwin-arm64.dylib.node'),'PRISMA_GENERATE_SKIP_AUTOINSTALL':'true','AXIOM_BUDGET_PG_ROOT':str(root),'AXIOM_BUDGET_PG_SOCKET':str(socket)}
start_requested=False
log=open(evidence/'owned-pg.log','w')
def run(args,timeout=120,check=True):
 r=subprocess.run([str(a) for a in args],env=env,cwd=repo,capture_output=True,text=True,timeout=timeout)
 log.write('ARGV '+json.dumps([str(a) for a in args])+'\n'+r.stdout+r.stderr+'\nEXIT '+str(r.returncode)+'\n');log.flush()
 if check and r.returncode:raise RuntimeError('owned fixture command failed')
 return r
try:
 (evidence/'owned-pg-location.json').write_text(json.dumps({'root':str(root),'socket':str(socket),'port':55439,'role':'budget_fixture','database':'axiom_budget_fixture'}))
 run([bins/'initdb','-D',root/'data','-U','budget_fixture','--locale=C','--encoding=UTF8','--auth-local=trust','--auth-host=reject'])
 start_requested=True
 run([bins/'pg_ctl','-D',root/'data','-l',root/'server.log','-o',"-p 55439 -k "+str(socket)+" -c listen_addresses='' -c unix_socket_permissions=0700",'-w','start'],timeout=60)
 # Validate the isolated cluster before creating a database or pushing schema.
 binding=run([bins/'psql','-X','-w','-d','postgres','-At','-c',"SELECT current_user||'|'||current_setting('listen_addresses')||'|'||current_setting('data_directory')"])
 if binding.stdout.strip()!='budget_fixture||'+str(root/'data'):raise RuntimeError('owned cluster binding mismatch')
 run([bins/'createdb','-w','axiom_budget_fixture'])
 binding=run([bins/'psql','-X','-w','-At','-c',"SELECT current_database()||'|'||current_user||'|'||current_setting('listen_addresses')||'|'||current_setting('data_directory')"])
 if binding.stdout.strip()!='axiom_budget_fixture|budget_fixture||'+str(root/'data'):raise RuntimeError('owned database binding mismatch')
 run([node,'node_modules/prisma/build/index.js','db','push','--schema',evidence/'schema.prisma','--skip-generate'])
 run([node,'node_modules/vitest/vitest.mjs','run','--config',evidence/'pg-vitest.config.mjs','--configLoader','native','--reporter','verbose'])
finally:
 if start_requested:
  # Inspect/stop this data directory only, including uncertain pg_ctl start outcomes.
  status=run([bins/'pg_ctl','-D',root/'data','status'],check=False)
  if status.returncode==0:run([bins/'pg_ctl','-D',root/'data','-m','fast','-w','stop'],timeout=60)
  elif status.returncode!=3:log.write('CLEANUP UNCERTAIN: inspect owned data directory only\n')
 log.close()
