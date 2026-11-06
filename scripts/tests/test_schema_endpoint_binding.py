"""Pure mocked responses only; no provider/SQL/environment/credential reads."""
import contextlib,io,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import schema_endpoint_binding as binding
class PrivateEndpointBindingTests(unittest.TestCase):
 secret='DO_NOT_DISCLOSE_FAKE_PASSWORD_817263'
 def data(self):
  meta={'envs':[{'id':'env123','key':'DATABASE_URL','target':['production'],'updatedAt':1793900000000,'value':'discard_this_entire_value'}]}
  detail={'id':'env123','key':'DATABASE_URL','target':['production'],'updatedAt':1793900000000,'value':'postgresql://neondb_owner:'+self.secret+'@ep-test-123-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require'}
  endpoints={'endpoints':[{'id':'ep-test-123','project_id':binding.NEON_PROJECT,'branch_id':binding.NEON_BRANCH,'host':'ep-test-123.us-east-2.aws.neon.tech','type':'read_write'}]}
  return meta,detail,endpoints
 def checked(self,*args):
  output=io.StringIO()
  with contextlib.redirect_stdout(output),contextlib.redirect_stderr(output):result=binding.verify_private_endpoint_binding(*args)
  encoded=json.dumps(result)+output.getvalue();self.assertNotIn(self.secret,encoded);self.assertNotIn('postgresql://',encoded);self.assertNotIn('discard_this_entire_value',encoded);self.assertEqual(output.getvalue(),'');return result
 def test_exact_existing_endpoint_join_returns_no_credentials(self):
  args=self.data();result=self.checked(*args);self.assertEqual(result['status'],'binding_verified');self.assertEqual(result['endpoint_id'],'ep-test-123');self.assertEqual(result['database'],'neondb');self.assertEqual(binding.select_database_env_id(args[0]),'env123')
 def test_metadata_alone_never_proves_binding(self):
  args=self.data();self.assertEqual(self.checked(args[0],{},args[2])['status'],'unverified')
 def test_foreign_branch_official_host_and_alias_refuse(self):
  for mutation in ['branch','host','alias','role','db','id','updated']:
   meta,detail,endpoints=self.data()
   if mutation=='branch':endpoints['endpoints'][0]['branch_id']='br-foreign'
   elif mutation=='host':detail['value']=detail['value'].replace('aws.neon.tech','aws.neon.tech.attacker.test')
   elif mutation=='alias':detail['value']=detail['value'].replace('ep-test-123-pooler','ep-other')
   elif mutation=='role':detail['value']=detail['value'].replace('neondb_owner','postgres')
   elif mutation=='db':detail['value']=detail['value'].replace('/neondb?','/customer?')
   elif mutation=='id':detail['id']='env456'
   else:detail['updatedAt']+=1
   self.assertEqual(self.checked(meta,detail,endpoints)['status'],'unverified')
 def test_ambiguous_or_nonproduction_env_refuses(self):
  meta,detail,endpoints=self.data();meta['envs'].append(dict(meta['envs'][0]));self.assertEqual(self.checked(meta,detail,endpoints)['status'],'unverified')
  meta,detail,endpoints=self.data();meta['envs'][0]['target']=['preview'];self.assertIsNone(binding.select_database_env_id(meta));self.assertEqual(self.checked(meta,detail,endpoints)['status'],'unverified')
 def test_malformed_provider_error_or_uri_never_leaks(self):
  meta,detail,endpoints=self.data()
  for raw in [None,{'error':self.secret},self.secret,{'value':self.secret},dict(detail,value='postgresql://'+self.secret+'@[broken')]:
   self.assertEqual(self.checked(meta,raw,endpoints)['status'],'unverified')
 def test_connection_query_cannot_override_official_host(self):
  for query in ['host=attacker.test','hostaddr=127.0.0.1','service=elsewhere','sslmode=disable','sslmode=require&sslmode=disable']:
   meta,detail,endpoints=self.data();detail['value']=detail['value'].split('?')[0]+'?'+query
   self.assertEqual(self.checked(meta,detail,endpoints)['status'],'unverified')
if __name__=='__main__':unittest.main()
