"""Ordinary synthetic files only; no signing or native execution."""
from pathlib import Path
import sys,unittest,tempfile,json,copy
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import system_build_inputs as inputs
from governance_local_issuer.tests.test_saved_profile_observation import fixture
from governance_local_issuer.saved_profile_observation import inspect_guard_no_entitlements

class RoleProfilesTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name).resolve();self.roles={};self.preparations=[]
  self.empty=b'<?xml version="1.0"?><plist version="1.0"><dict/></plist>'
  for role in ('owner','maintenance','bootstrap','guard'):
   source=self.put(role+'-source',b'unsigned '+role.encode());artifact=self.put(role,fixture() if role=='guard' else b'signed '+role.encode());identifier=inputs.ROLE_IDENTIFIERS[role]
   recipe={'role':role,'argv':['compile',source['path']],'output':source['path']};prep=self.putjson(role+'-prep',{'staging':str(self.root),'compileRecipes':[recipe]});self.preparations.append(prep)
   compile=self.putjson(role+'-compile',{'stage':str(self.root),'manifestSha256':prep['sha256'],'exit':0,'artifact':source,'argv':recipe['argv']})
   argv=[[name,artifact['path']] for name in ('sign','verify','display')];packet=self.putjson(role+'-packet',{'artifact':source,'target':artifact['path'],'commands':argv})
   cd=inspect_guard_no_entitlements(fixture(),inputs.ROLE_IDENTIFIERS['guard'],'FG5N98FE6W')['cdhash']
   display=(f'Identifier={identifier}\nTeamIdentifier=FG5N98FE6W\nFormat=Mach-O thin (arm64)\nCodeDirectory flags=0x10000(runtime)\nInfo.plist=not bound\nSealed Resources=none\nCDHash={cd}\n').encode()
   logs=[];commands=[]
   for i,command in enumerate(argv):
    out=self.empty if i==2 and role!='guard' else b'';err=display if i==2 else b''
    logs.append({'stdout':self.put(f'{role}-{i}-out',out),'stderr':self.put(f'{role}-{i}-err',err)})
    commands.append({'argv':command,'state':'completed','exit':0,'elapsed_seconds':.1,'stdout_bytes':len(out),'stderr_bytes':len(err)})
   result=self.putjson(role+'-result',{'artifact_after':artifact,'profile_matches':True,'results':commands})
   self.roles[role]={'identifier':identifier,'artifact':artifact,'resultReceipt':result,'displayStdout':logs[2]['stdout'],'displayStderr':logs[2]['stderr'],'rawLogs':logs,'provenance':{'signingPacket':packet,'compileReceipt':compile,'preparationReceipt':prep,'savedCommands':self.putjson(role+'-commands',commands)}}
 def put(self,name,data):
  p=self.root/name;p.write_bytes(data);p.chmod(0o600);return inputs.binding(p)
 def putjson(self,name,value):return self.put(name,json.dumps(value).encode())
 def observe(self):
  from governance_local_issuer.system_role_profiles import observe_role_profiles
  return observe_role_profiles(self.roles,self.preparations)
 def test_distinct_role_packets_return_exact_closed_composition(self):
  result=self.observe();self.assertEqual(result['format'],'axiom.saved-system-role-profiles/2');self.assertEqual([x['role'] for x in result['representations']],list(self.roles));self.assertEqual(len({x['signingPacket']['sha256'] for x in result['representations']}),4)
  self.assertEqual(set(result),{'format','representations','executionAuthorized','installationReady','cryptographicSignatureVerifiedHere','operationalIdentity'})
  for entry in result['representations']:
   self.assertEqual(set(entry),{'role','identifier','artifact','signingPacket','savedCommands','resultReceipt','sourceArtifact','observation'});self.assertFalse(entry['observation']['executionAuthorized'])
 def test_extra_or_missing_roles_refused(self):
  for roles in ({},dict(self.roles,node=self.roles['owner'])):
   self.roles=roles;self.assertRaises(ValueError,self.observe)
 def test_changed_source_refused(self):
  (self.root/'owner-source').write_bytes(b'changed');self.assertRaises(ValueError,self.observe)
 def test_swapped_provenance_refused(self):
  self.roles['owner']['provenance']=self.roles['maintenance']['provenance'];self.assertRaises(ValueError,self.observe)
 def test_changed_raw_logs_refused(self):
  (self.root/'owner-0-out').write_bytes(b'changed');self.assertRaises(ValueError,self.observe)
 def test_nonxml_or_nonempty_executable_profile_refused(self):
  for raw in (b'',b'bplist00',b'<?xml version="1.0"?><plist><dict><key>x</key><true/></dict></plist>'):
   item=self.roles['owner'];item['displayStdout']=self.put('owner-2-out',raw);item['rawLogs'][2]['stdout']=item['displayStdout'];self.assertRaises(ValueError,self.observe)
 def rewrite_commands(self,change):
  item=self.roles['owner'];result=json.loads(Path(item['resultReceipt']['path']).read_text());change(result['results']);item['resultReceipt']=self.putjson('owner-result',result);item['provenance']['savedCommands']=self.putjson('owner-commands',result['results'])
 def test_invalid_timing_counts_exit_or_argv_refused(self):
  baseline=copy.deepcopy(self.roles);base_result=json.loads(Path(self.roles['owner']['resultReceipt']['path']).read_text())
  for key,value in [('elapsed_seconds',True),('elapsed_seconds',11),('stdout_bytes',True),('stderr_bytes',1),('exit',True),('exit',1),('argv',['other'])]:
   with self.subTest(key=key,value=value):
    self.roles=copy.deepcopy(baseline);self.roles['owner']['resultReceipt']=self.putjson('owner-result',base_result);self.rewrite_commands(lambda commands:commands[0].update({key:value}));self.assertRaises(ValueError,self.observe)
 def test_saved_commands_must_equal_result(self):
  self.roles['owner']['provenance']['savedCommands']=self.putjson('different-commands',[]);self.assertRaises(ValueError,self.observe)
 def test_wrong_display_fields_with_correct_counts_refused(self):
  item=self.roles['owner'];original=Path(item['displayStderr']['path']).read_bytes()
  for old,new in [(b'FG5N98FE6W',b'WRONGTEAMX'),(b'not bound',b'yes bound'),(b'none',b'some'),(b'0x10000',b'0x20000'),(b'arm64',b'x8664')]:
   raw=original.replace(old,new);item['displayStderr']=self.put('owner-2-err',raw);item['rawLogs'][2]['stderr']=item['displayStderr'];self.assertRaises(ValueError,self.observe)
 def test_leaf_packet_joins_real_same_role_preimage(self):
  for role,item in self.roles.items():
   packet=json.loads(Path(item['provenance']['signingPacket']['path']).read_text());target=dict(item['artifact']);target['sha256']=packet['artifact']['sha256']
   item['provenance']['signingPacket']=self.putjson(role+'-leafpacket',{'leaves':[{'role':role,'identifier':item['identifier'],'target':target,'sourceArtifact':packet['artifact'],'commands':packet['commands']}]})
  self.assertEqual(len(self.observe()['representations']),4)
 def test_full_stat_recheck_refuses_same_bytes_replacement(self):
  original=inputs.prep._snapshot;target=self.root/'owner-source';seen=[False]
  def snapshot(path,limit=inputs.prep.MAX_FILE):
   value=original(path,limit)
   if Path(path)==self.root/'guard-2-err' and not seen[0]:
    seen[0]=True;raw=target.read_bytes();target.unlink();target.write_bytes(raw);target.chmod(0o600)
   return value
  with patch.object(inputs.prep,'_snapshot',side_effect=snapshot):self.assertRaises(ValueError,self.observe)
if __name__=='__main__':unittest.main()
