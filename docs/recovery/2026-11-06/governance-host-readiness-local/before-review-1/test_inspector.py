import importlib.util,json,unittest
from pathlib import Path
P=Path(__file__).with_name('inspector.py')
class Tests(unittest.TestCase):
 def setUp(self):
  self.assertTrue(P.exists(),'fixed inspector implementation missing')
  spec=importlib.util.spec_from_file_location('inspector',P);self.m=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.m)
 def test_exact_commands(self):
  c=self.m.COMMANDS;self.assertEqual(len(c),16);self.assertEqual([x[0]for x in c],['/usr/bin/dscl']*7+['/usr/bin/otool']*6+['/bin/launchctl']*3)
 def test_directory_privacy_collision_ambiguity(self):
  m=self.m;self.assertEqual(m.directory_projection(0,0,b'operatorPrivate 501\n',b''),'operator_id_present')
  self.assertEqual(m.directory_projection(1,0,b'',b''),'absent')
  for raw in [b'SECRET_MARKER 65001\n',b'a 65001\nb 65001\n',b'malformed SECRET_MARKER']:
   with self.assertRaises(m.Stop)as e:m.directory_projection(1,0,raw,b'SECRET_MARKER')
   self.assertNotIn('SECRET_MARKER',str(e.exception))
 def test_service_never_exports_raw(self):
  m=self.m;self.assertEqual(m.service_projection(113,b'',b'Could not find service "'+m.LABELS[0].encode()+b'" in domain for system\n',m.LABELS[0]),'absent')
  for code,out,err in [(0,b'SECRET_MARKER',b''),(1,b'',b'SECRET_MARKER')]:
   with self.assertRaises(m.Stop)as e:m.service_projection(code,out,err,m.LABELS[0])
   self.assertNotIn('SECRET_MARKER',str(e.exception))
 def test_dependencies_only_categories_no_paths(self):
  m=self.m;r=m.otool_projection('-L',m.PG[0],(m.PG[0]+':\n\t/usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1.0.0)\n\t/opt/private/SECRET_MARKER.dylib (compatibility version 1.0.0, current version 1.0.0)\n').encode())
  self.assertEqual(r,{'system':1,'nonSystem':1,'completeClosureQualified':False});self.assertNotIn('SECRET_MARKER',json.dumps(r))
 def test_budget_stops_before_next_command(self):
  m=self.m;clock=iter([0,121]);b=m.Budget(lambda:next(clock));
  with self.assertRaises(m.Stop):b.remaining()
 def test_command_failure_output_cap_and_timeout_are_finite(self):
  m=self.m
  for value in [(0,b'x'*65537,b'',0.1),(0,b'',b'',10.1),(None,b'SECRET_MARKER',b'',1)]:
   with self.assertRaises(m.Stop)as e:m.check_command(*value)
   self.assertNotIn('SECRET_MARKER',str(e.exception))
 def test_path_refuses_alias_acl_writable_and_collision(self):
  m=self.m
  for d in [dict(kind='symlink',uid=0,gid=0,mode=493,acl=False),dict(kind='directory',uid=0,gid=0,mode=511,acl=False),dict(kind='directory',uid=0,gid=0,mode=493,acl=True)]:
   with self.assertRaises(m.Stop):m.path_projection(d,False)
  with self.assertRaises(m.Stop):m.path_projection(dict(kind='directory',uid=0,gid=0,mode=493,acl=False),True)
  self.assertEqual(m.path_projection(None,True),'absent')
 def test_full_mock_stops_at_first_foreign_no_followups(self):
  m=self.m;calls=[]
  def run(argv,budget):calls.append(argv);return (0,b'SECRET_MARKER 501\n' if len(calls)==1 else b'FOREIGN_SECRET 65001\n',b'',0.01)
  out=m.inspect(run=run,metadata=lambda p,leaf,b:None,pg=lambda p,b:{},operator=lambda:(501,20),budget=m.Budget(lambda:0))
  self.assertEqual(len(calls),2);self.assertEqual(out['state'],'stopped');self.assertNotIn('SECRET',json.dumps(out))
 def test_complete_synthetic_sixteen_command_journey(self):
  m=self.m;calls=[]
  def run(argv,b):
   calls.append(argv);i=m.COMMANDS.index(argv)
   if i<7:return 0,(b'PRIVATE_OPERATOR 501\n'if i==0 else b'PRIVATE_GROUP 20\n'if i==3 else b''),b'',0.01
   if i<13:
    return 0,(argv[2]+(':\n\t/usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1.0.0)\n'if argv[1]=='-L'else ':\nLoad command 0\n cmd LC_UUID\n')).encode(),b'',0.01
   return 113,b'',('Could not find service "'+m.LABELS[i-13]+'" in domain for system\n').encode(),0.01
  r=m.inspect(run=run,metadata=lambda p,leaf,b:None,pg=lambda p,b:{'sha256':'a'*64},operator=lambda:(501,20),budget=m.Budget(lambda:0))
  self.assertEqual(r['state'],'observed_unqualified');self.assertEqual(calls,list(m.COMMANDS));self.assertNotIn('PRIVATE_',json.dumps(r));self.assertFalse(r['installationReady'])
 def test_acl_failures_never_promoted(self):
  m=self.m
  for raw in [b'unknown',b'Could not find service "wrong" in domain for system']:
   with self.assertRaises(m.Stop):m.service_projection(113,b'',raw,m.LABELS[0])
 def test_outer_entrypoint_exists(self):
  self.assertTrue(P.with_name('controller.py').exists(),'bounded frozen outer entry missing')
 def test_failing_fixed_path_retains_safe_diagnostic(self):
  m=self.m
  def run(argv,b):
   i=m.COMMANDS.index(argv);return 0,(b'PRIVATE 501\n'if i==0 else b'PRIVATE 20\n'if i==3 else b''),b'',0.01
  r=m.inspect(run=run,metadata=lambda p,leaf,b:dict(kind='directory',uid=501,gid=20,mode=493,acl=False),operator=lambda:(501,20),budget=m.Budget(lambda:0))
  self.assertEqual(r['lastBoundary']['coordinate'],'/Library');self.assertEqual(r['paths'][-1]['metadata']['uid'],501);self.assertEqual(r['state'],'stopped')
if __name__=='__main__':unittest.main()
