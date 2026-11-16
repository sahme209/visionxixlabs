"""Source/packet tests ONLY. These are NOT actual PostgreSQL acceptance."""
from pathlib import Path
import importlib.util,json,hashlib,unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('source_prepare',HERE/'prepare.py');unit=importlib.util.module_from_spec(spec);spec.loader.exec_module(unit)
class PacketTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.packet=json.loads((HERE/'CONDITIONAL-APPLY.json').read_text());cls.statements=cls.packet['args']['sql_statements'];cls.source=json.loads((HERE/'SOURCE-MIGRATIONS.json').read_text());cls.ddl=(HERE/'exact-migration.sql').read_text();cls.full='\n'.join(cls.statements)
 def test_all121_current_source_checksums(self):
  self.assertEqual(len(self.source['migrations']),121)
  for row in self.source['migrations']:self.assertEqual(unit.sha(unit.ROOT/'prisma/migrations'/row['name']/'migration.sql'),row['checksum'])
 def test_exact_ddl_original_bytes_and_seven_source_slices(self):
  self.assertEqual(hashlib.sha256(self.ddl.encode()).hexdigest(),self.packet['sourceMigration']['checksum']);parts,tail=unit.split_sql(self.ddl);self.assertEqual(self.statements[8:15],parts);self.assertEqual(''.join(parts)+tail,self.ddl);self.assertEqual(len(parts),7)
 def test_splitter_quoted_semicolon_and_escaped_quote(self):
  text='-- comment; remains\nCREATE TABLE "a;b" (v text CHECK(v=\'a;\'\'b\'));\n'
  parts,tail=unit.split_sql(text);self.assertEqual(len(parts),1);self.assertEqual(''.join(parts)+tail,text)
 def test_splitter_unsupported_complex_source_refuses(self):
  for value in ['/* unknown */ SELECT 1;','DO $tag$ BEGIN END $tag$;','SELECT \'bad;','SELECT 1']:
   with self.assertRaises(RuntimeError):unit.split_sql(value)
 def test_target_coordinates_all_explicit_no_defaults(self):
  args=self.packet['args'];self.assertEqual(args['project_id'],'odd-union-57413470');self.assertEqual(args['branch_id'],'br-holy-voice-ai303o8m');self.assertEqual(args['compute_id'],'ep-small-mountain-ailw0kvt');self.assertEqual(args['database_name'],'neondb');self.assertEqual(args['role_name'],'neondb_owner');self.assertEqual(args['max_rows'],1)
 def test_ordered_tool_owned_transaction_timeouts_outside_do(self):
  self.assertEqual(len(self.statements),17);self.assertEqual(self.statements[:4],['SET TRANSACTION ISOLATION LEVEL READ COMMITTED READ WRITE',"SET LOCAL lock_timeout = '2s'","SET LOCAL statement_timeout = '30s'","SET LOCAL search_path = public"])
  self.assertFalse(any(s.strip().upper() in ['BEGIN','BEGIN;','COMMIT','COMMIT;'] for s in self.statements));self.assertTrue(self.statements[4].startswith('DO $guard$'));self.assertIn('pg_try_advisory_xact_lock',self.statements[4]);self.assertNotIn('statement_timeout',self.statements[4])
 def test_ledger_and_user_locked_before_baseline_ddl(self):
  self.assertEqual(self.statements[5],'LOCK TABLE ONLY public."_prisma_migrations" IN SHARE ROW EXCLUSIVE MODE');self.assertEqual(self.statements[6],'LOCK TABLE ONLY public."User" IN SHARE MODE');self.assertTrue(self.statements[7].startswith('DO $baseline$'))
 def test_each_exact120_baseline_pair_present_and_target_excluded(self):
  guard=self.statements[7];baseline=[r for r in self.source['migrations'] if r['name']!=unit.TARGET];self.assertEqual(len(baseline),120)
  for row in baseline:self.assertIn("('"+row['name']+"','"+row['checksum']+"')",guard)
  self.assertNotIn("('"+unit.TARGET+"','"+self.packet['sourceMigration']['checksum']+"')",guard)
 def test_unknown_unfinished_rolledback_duplicate_checksum_are_refused(self):
  guard=self.statements[7]
  for needle in ['<>120','finished_at IS NULL OR rolled_back_at IS NOT NULL','count(m.id)<>1','bool_and(m.checksum=e.checksum)','GIM_010_ledger_name_checksum_or_duplicate_drift']:self.assertIn(needle,guard)
 def test_exact_one_source_checksum_ledger_insert_only_after_ddl(self):
  receipt=self.statements[15];self.assertTrue(receipt.startswith('INSERT INTO public."_prisma_migrations"'));self.assertIn(self.packet['sourceMigration']['checksum'],receipt);self.assertEqual(self.full.count('INSERT INTO'),1);self.assertEqual(self.full.count("VALUES(pg_catalog.gen_random_uuid()"),1);self.assertIn('NULL,NULL,pg_catalog.transaction_timestamp(),1)',receipt)
 def test_no_user_email_backfill_or_grants_or_other_migration(self):
  self.assertNotIn('INSERT INTO public."User"',self.full);self.assertNotIn('UPDATE public.',self.full);self.assertNotIn('GRANT ',self.full);self.assertNotIn('REVOKE ',self.full);self.assertNotIn('ALTER TABLE',self.full);self.assertEqual(self.ddl.count('CREATE TABLE '),2);self.assertNotIn('IF NOT EXISTS',self.ddl)
 def test_absent_target_tables_types_indexes_required(self):
  for name in ['OAuthIdentity','PendingGoogleIdentityLink','OAuthIdentity_provider_issuer_subject_key','PendingGoogleIdentityLink_expiresAt_idx']:
   self.assertIn(name,self.statements[7])
  self.assertIn('pg_catalog.pg_type',self.statements[7]);self.assertIn('GIM_012_target_object_already_present',self.statements[7])
 def test_current_user_types_defaults_indexes_and_ledger_structure_required(self):
  guard=self.statements[7]
  for needle in ["<>13","'emailVerifiedAt','timestamp(3) without time zone',false","'modules','jsonb',false",'GIM_022_user_default_drift','GIM_014_user_identity_index_drift',"'id','character varying(36)',true",'GIM_024_ledger_constraint_drift']:self.assertIn(needle,guard)
 def test_identity_no_temp_hooks_or_implicit_grants(self):
  guard=self.statements[4]
  for needle in ["CURRENT_USER<>'neondb_owner'","SESSION_USER<>'neondb_owner'","current_database()<>'neondb'",'pg_my_temp_schema()<>0','pg_catalog.pg_event_trigger','pg_catalog.pg_default_acl','a.grantee<>d.defaclrole']:self.assertIn(needle,guard)
 def test_public_search_path_builtin_precedence_and_no_persistent_gucs(self):
  self.assertEqual(self.statements[3],'SET LOCAL search_path = public');self.assertNotIn('ALTER SYSTEM',self.full);self.assertNotIn('ALTER ROLE',self.full)
 def test_atomic_postchecks_required_before_tool_commit(self):
  post=self.statements[-1]
  for needle in ['<>121','applied_steps_count=1','<>13','<>7',"confupdtype='c' AND confdeltype='c'",'GIM_021_created_acl_postcheck']:self.assertIn(needle,post)
 def test_prepared_no_production_or_execution_claim(self):
  self.assertTrue(self.packet['preparedOnly']);self.assertFalse(self.packet['executed']);self.assertTrue(self.packet['targetIdentityNotCurrentlyVerified']);self.assertTrue(self.packet['requiresFreshIdentityBackupScopeAndConsent'])
if __name__=='__main__':unittest.main()
