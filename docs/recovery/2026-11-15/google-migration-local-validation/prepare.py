"""Source-only conditional migration packet. No DB/client/network imports."""
from pathlib import Path
import hashlib,json,re,subprocess
ROOT=Path('/Users/samirahmed/.codex/worktrees/axiom-governance-recovery-2026-11-14')
HERE=Path(__file__).resolve().parent
TARGET='20261115180000_google_identity_binding'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def quote(s):return "'"+s.replace("'","''")+"'"
def split_sql(text):
 result=[];start=0;i=0;state='normal'
 while i<len(text):
  c=text[i];n=text[i:i+2]
  if state=='comment':
   if c=='\n':state='normal'
  elif state in ['single','double']:
   mark="'" if state=='single' else '"'
   if c==mark:
    if text[i+1:i+2]==mark:i+=1
    else:state='normal'
  elif n=='--':state='comment';i+=1
  elif c=="'":state='single'
  elif c=='"':state='double'
  elif n=='/*' or c=='$':raise RuntimeError('unsupported_source_sql_lexeme')
  elif c==';':result.append(text[start:i+1]);start=i+1
  i+=1
 if state not in ['normal','comment']:raise RuntimeError('unterminated_source_sql')
 if text[start:].strip():raise RuntimeError('unexpected_source_sql_tail')
 if ''.join(result)+text[start:]!=text:raise RuntimeError('source_sql_preservation_failed')
 return result,text[start:]
def main():
 migrations=[]
 for p in sorted((ROOT/'prisma/migrations').glob('*/migration.sql')):
  if not re.fullmatch(r'\d{14}_[a-z0-9_]+',p.parent.name):raise RuntimeError('migration_name_invalid')
  migrations.append({'name':p.parent.name,'checksum':sha(p)})
 assert len(migrations)==121
 target=next(x for x in migrations if x['name']==TARGET);baseline=[x for x in migrations if x['name']!=TARGET];assert len(baseline)==120
 ddl=(ROOT/'prisma/migrations'/TARGET/'migration.sql').read_text();parts,tail=split_sql(ddl);assert len(parts)==7
 (HERE/'exact-migration.sql').write_text(ddl)
 (HERE/'SOURCE-MIGRATIONS.json').write_text(json.dumps({'sourceCommit':subprocess.check_output(['/usr/bin/git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'count':121,'target':target,'baselineCount':120,'migrations':migrations},indent=2)+'\n')
 expected=',\n'.join('('+quote(x['name'])+','+quote(x['checksum'])+')' for x in baseline)
 expected_columns=[('id','text',True),('email','text',True),('name','text',False),('passwordHash','text',False),('emailVerifiedAt','timestamp(3) without time zone',False),('image','text',False),('stripeCustomerId','text',False),('stripeSubscriptionId','text',False),('plan','text',False),('planExpiresAt','timestamp(3) without time zone',False),('modules','jsonb',False),('createdAt','timestamp(3) without time zone',True),('updatedAt','timestamp(3) without time zone',True)]
 cols=',\n'.join('('+quote(n)+','+quote(t)+','+('true' if nn else 'false')+')' for n,t,nn in expected_columns)
 guard=f'''DO $guard$
BEGIN
 IF pg_catalog.current_database()<>'neondb' OR CURRENT_USER<>'neondb_owner' OR SESSION_USER<>'neondb_owner' OR pg_catalog.current_setting('transaction_read_only')<>'off' OR pg_catalog.current_setting('transaction_isolation')<>'read committed'
 THEN RAISE EXCEPTION 'GIM_001_identity_or_transaction_refused'; END IF;
 IF pg_catalog.pg_my_temp_schema()<>0 THEN RAISE EXCEPTION 'GIM_002_temporary_namespace_refused'; END IF;
 IF NOT pg_catalog.pg_try_advisory_xact_lock(20261115,180000) THEN RAISE EXCEPTION 'GIM_003_migration_lock_unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_event_trigger WHERE evtenabled<>'D') THEN RAISE EXCEPTION 'GIM_004_unreviewed_ddl_hook'; END IF;
 IF NOT pg_catalog.has_schema_privilege(CURRENT_USER,'public','USAGE') OR NOT pg_catalog.has_schema_privilege(CURRENT_USER,'public','CREATE')
 THEN RAISE EXCEPTION 'GIM_005_schema_privilege_refused'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_default_acl d CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
 WHERE d.defaclrole=pg_catalog.to_regrole(CURRENT_USER) AND d.defaclobjtype='r' AND d.defaclnamespace IN(0,'public'::pg_catalog.regnamespace) AND a.grantee<>d.defaclrole)
 THEN RAISE EXCEPTION 'GIM_006_implicit_grant_refused'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN('_prisma_migrations','User') AND c.relkind='r' AND NOT c.relispartition AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity AND c.relowner=pg_catalog.to_regrole(CURRENT_USER))<>2
 THEN RAISE EXCEPTION 'GIM_007_prerequisite_relation_refused'; END IF;
END $guard$;'''
 baseline_guard=f'''DO $baseline$
BEGIN
 IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('_prisma_migrations','User') AND c.relkind='r' AND NOT c.relispartition AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity AND c.relowner=pg_catalog.to_regrole(CURRENT_USER))<>2
 THEN RAISE EXCEPTION 'GIM_007_prerequisite_relation_refused'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_attribute WHERE attrelid='public."_prisma_migrations"'::pg_catalog.regclass AND attnum>0 AND NOT attisdropped)<>8
 OR EXISTS(WITH expected(name,typ,nn) AS(VALUES ('id','character varying(36)',true),('checksum','character varying(64)',true),('finished_at','timestamp with time zone',false),('migration_name','character varying(255)',true),('logs','text',false),('rolled_back_at','timestamp with time zone',false),('started_at','timestamp with time zone',true),('applied_steps_count','integer',true))
 SELECT 1 FROM expected e LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid='public."_prisma_migrations"'::pg_catalog.regclass AND a.attname=e.name AND a.attnum>0 AND NOT a.attisdropped WHERE a.attname IS NULL OR pg_catalog.format_type(a.atttypid,a.atttypmod)<>e.typ OR a.attnotnull<>e.nn OR a.attgenerated<>'' OR a.attidentity<>'')
 THEN RAISE EXCEPTION 'GIM_023_ledger_column_drift'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_constraint WHERE conrelid='public."_prisma_migrations"'::pg_catalog.regclass)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_attribute a ON a.attrelid=k.conrelid AND a.attname='id' WHERE k.conrelid='public."_prisma_migrations"'::pg_catalog.regclass AND k.contype='p' AND k.convalidated AND NOT k.condeferrable AND k.conkey=ARRAY[a.attnum]::smallint[])
 THEN RAISE EXCEPTION 'GIM_024_ledger_constraint_drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public."_prisma_migrations"'::pg_catalog.regclass AND NOT tgisinternal AND tgenabled<>'D')
 THEN RAISE EXCEPTION 'GIM_008_ledger_hook_refused'; END IF;
 IF (SELECT count(*) FROM public."_prisma_migrations")<>120 OR EXISTS(SELECT 1 FROM public."_prisma_migrations" WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)
 THEN RAISE EXCEPTION 'GIM_009_ledger_not_clean_120'; END IF;
 IF EXISTS(WITH expected(name,checksum) AS(VALUES {expected})
 SELECT 1 FROM expected e LEFT JOIN public."_prisma_migrations" m ON m.migration_name=e.name
 GROUP BY e.name,e.checksum HAVING count(m.id)<>1 OR bool_and(m.checksum=e.checksum) IS NOT TRUE)
 THEN RAISE EXCEPTION 'GIM_010_ledger_name_checksum_or_duplicate_drift'; END IF;
 IF EXISTS(SELECT 1 FROM public."_prisma_migrations" WHERE migration_name='{TARGET}')
 THEN RAISE EXCEPTION 'GIM_011_target_receipt_already_present'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('OAuthIdentity','PendingGoogleIdentityLink','OAuthIdentity_pkey','OAuthIdentity_provider_issuer_subject_key','OAuthIdentity_userId_provider_issuer_key','PendingGoogleIdentityLink_pkey','PendingGoogleIdentityLink_browserNonceHash_key','PendingGoogleIdentityLink_emailProofHash_key','PendingGoogleIdentityLink_expiresAt_idx'))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname IN('OAuthIdentity','PendingGoogleIdentityLink'))
 THEN RAISE EXCEPTION 'GIM_012_target_object_already_present'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_attribute WHERE attrelid='public."User"'::pg_catalog.regclass AND attnum>0 AND NOT attisdropped)<>13
 OR EXISTS(WITH expected(name,typ,nn) AS(VALUES {cols})
 SELECT 1 FROM expected e LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid='public."User"'::pg_catalog.regclass AND a.attname=e.name AND a.attnum>0 AND NOT a.attisdropped
 WHERE a.attname IS NULL OR pg_catalog.format_type(a.atttypid,a.atttypmod)<>e.typ OR a.attnotnull<>e.nn OR a.attgenerated<>'' OR a.attidentity<>'')
 THEN RAISE EXCEPTION 'GIM_013_user_column_drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public."User"'::pg_catalog.regclass AND a.attnum>0 AND NOT a.attisdropped AND (a.attname='createdAt' AND (d.adbin IS NULL OR pg_catalog.pg_get_expr(d.adbin,d.adrelid) NOT IN('CURRENT_TIMESTAMP','now()')) OR a.attname<>'createdAt' AND d.adbin IS NOT NULL))
 THEN RAISE EXCEPTION 'GIM_022_user_default_drift'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_attribute a ON a.attrelid=k.conrelid AND a.attname='id' WHERE k.conrelid='public."User"'::pg_catalog.regclass AND k.contype='p' AND k.convalidated AND NOT k.condeferrable AND k.conkey=ARRAY[a.attnum]::smallint[])
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_index i JOIN pg_catalog.pg_attribute a ON a.attrelid=i.indrelid AND a.attname='email' WHERE i.indrelid='public."User"'::pg_catalog.regclass AND i.indisunique AND i.indisvalid AND i.indisready AND i.indnkeyatts=1 AND i.indnatts=1 AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indkey::text=a.attnum::text)
 THEN RAISE EXCEPTION 'GIM_014_user_identity_index_drift'; END IF;
 IF NOT pg_catalog.has_table_privilege(CURRENT_USER,'public."User"','REFERENCES') OR NOT pg_catalog.has_table_privilege(CURRENT_USER,'public."_prisma_migrations"','SELECT') OR NOT pg_catalog.has_table_privilege(CURRENT_USER,'public."_prisma_migrations"','INSERT')
 THEN RAISE EXCEPTION 'GIM_015_table_privilege_refused'; END IF;
END $baseline$;'''
 ledger=f'''INSERT INTO public."_prisma_migrations"
(id,checksum,finished_at,migration_name,logs,rolled_back_at,started_at,applied_steps_count)
VALUES(pg_catalog.gen_random_uuid()::text,'{target['checksum']}',pg_catalog.clock_timestamp(),'{TARGET}',NULL,NULL,pg_catalog.transaction_timestamp(),1);'''
 post=f'''DO $post$
BEGIN
 IF (SELECT count(*) FROM public."_prisma_migrations")<>121 OR (SELECT count(*) FROM public."_prisma_migrations" WHERE migration_name='{TARGET}' AND checksum='{target['checksum']}' AND finished_at IS NOT NULL AND rolled_back_at IS NULL AND logs IS NULL AND applied_steps_count=1)<>1
 THEN RAISE EXCEPTION 'GIM_016_atomic_receipt_postcheck'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('OAuthIdentity','PendingGoogleIdentityLink') AND c.relkind='r' AND c.relowner=pg_catalog.to_regrole(CURRENT_USER))<>2
 THEN RAISE EXCEPTION 'GIM_017_created_relation_postcheck'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_constraint WHERE conrelid IN('public."OAuthIdentity"'::pg_catalog.regclass,'public."PendingGoogleIdentityLink"'::pg_catalog.regclass) AND convalidated AND NOT condeferrable)<>13
 THEN RAISE EXCEPTION 'GIM_018_created_constraint_postcheck'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_index WHERE indrelid IN('public."OAuthIdentity"'::pg_catalog.regclass,'public."PendingGoogleIdentityLink"'::pg_catalog.regclass) AND indisvalid AND indisready AND indpred IS NULL AND indexprs IS NULL)<>7
 THEN RAISE EXCEPTION 'GIM_019_created_index_postcheck'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_constraint WHERE conrelid IN('public."OAuthIdentity"'::pg_catalog.regclass,'public."PendingGoogleIdentityLink"'::pg_catalog.regclass) AND contype='f' AND confrelid='public."User"'::pg_catalog.regclass AND confupdtype='c' AND confdeltype='c' AND convalidated)<>2
 THEN RAISE EXCEPTION 'GIM_020_created_fk_postcheck'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a WHERE c.oid IN('public."OAuthIdentity"'::pg_catalog.regclass,'public."PendingGoogleIdentityLink"'::pg_catalog.regclass) AND a.grantee<>c.relowner)
 THEN RAISE EXCEPTION 'GIM_021_created_acl_postcheck'; END IF;
END $post$;'''
 statements=['SET TRANSACTION ISOLATION LEVEL READ COMMITTED READ WRITE',"SET LOCAL lock_timeout = '2s'","SET LOCAL statement_timeout = '30s'","SET LOCAL search_path = public",guard,'LOCK TABLE ONLY public."_prisma_migrations" IN SHARE ROW EXCLUSIVE MODE','LOCK TABLE ONLY public."User" IN SHARE MODE',baseline_guard,*parts,ledger,post]
 packet={'preparedOnly':True,'executed':False,'transactionOwnedByTool':True,'targetIdentityNotCurrentlyVerified':True,'requiresFreshIdentityBackupScopeAndConsent':True,'sourceMigration':target,'baselineCount':120,'sourceDdlStatements':len(parts),'sourceDdlTail':tail,'args':{'project_id':'odd-union-57413470','branch_id':'br-holy-voice-ai303o8m','compute_id':'ep-small-mountain-ailw0kvt','database_name':'neondb','role_name':'neondb_owner','max_rows':1,'sql_statements':statements}}
 (HERE/'CONDITIONAL-APPLY.json').write_text(json.dumps(packet,indent=2)+'\n')
 (HERE/'CONDITIONAL-APPLY.sql').write_text('-- PREPARATION ONLY. Tool supplies one transaction; NO nested BEGIN/COMMIT.\n'+'\n\n'.join(statements)+'\n')
 print(json.dumps({'preparedOnly':True,'sourceMigrations':121,'baselineMigrations':120,'statements':len(statements),'exactDdlSha256':target['checksum'],'packetSha256':sha(HERE/'CONDITIONAL-APPLY.json')}))
if __name__=='__main__':main()
