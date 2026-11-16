"""Pure receipt-path regression and harmless owned copy-on-write fixture only."""
from pathlib import Path
import hashlib,importlib.util,json,shutil,tempfile,types,unittest,sys
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent

def module(path):
 spec=importlib.util.spec_from_file_location('combined_build_fixture',path);u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u);return u

class Finalizer(unittest.TestCase):
 def exercise(self, shadow=False, copy_refusal=None):
  stages=[]
  with tempfile.TemporaryDirectory(prefix='v19-build-finalizer-pure-',dir='/private/tmp') as folder:
   root=Path(folder);work=root/'root';work.mkdir();(work/'sample.txt').write_text('synthetic source')
   (work/'node_modules/pkg').mkdir(parents=True);(work/'node_modules/pkg/value.js').write_text('synthetic dependency');(work/'node_modules/pkg/second.js').write_text('second synthetic dependency')
   (work/'node_modules/.bin').mkdir();(work/'node_modules/.bin/tool').symlink_to('../pkg/value.js')
   entry=HERE/'runner.py'
   if shadow:
    text=entry.read_text().replace('  for sig,handler in saved_handlers.items():','  saved_handlers=source/"node_modules"\n  for sig,handler in saved_handlers.items():');entry=root/'counterfactual.py';entry.write_text(text)
   u=module(entry);u.ROOT=work;u.HERE=root/'result';u.HERE.mkdir();u.PRELOAD=root/'preload.cjs';u.PRELOAD.write_text('// synthetic')
   owner_box=[];clock=[0];copied=[];ran=[]
   class Owner:
    cancelled=False
    def __init__(self):owner_box.append(self)
    def signal(self,*a):pass
    def run(self,argv,cwd,env,log,budget):
     ran.append(True);log.write_text('synthetic successful process outcome, no command executed')
     return {'exitCode':0,'cleanupConfirmed':True}
   unit=types.SimpleNamespace(ProcessOwner=Owner,child_environment=lambda *a:{'NODE_OPTIONS':''},sandbox_profile=lambda *a:'not executed',inventory=lambda *a:{},namespace_inventory=lambda *a:{})
   u.helper=lambda:unit;u.verify=lambda *a:None
   if copy_refusal:
    actual_clone=u.clone_regular_file
    def controlled_clone(src,dst):
     copied.append(str(src));value=actual_clone(src,dst)
     if copy_refusal=='cancelled':owner_box[0].cancelled=True
     else:clock[0]=601
     return value
    u.clone_regular_file=controlled_clone;u.time=types.SimpleNamespace(monotonic=lambda:clock[0])
   calls=[];u.signal=types.SimpleNamespace(SIGINT=2,SIGTERM=15,SIGHUP=1,signal=lambda sig,handler:calls.append((sig,handler)) or 'previous-handler')
   def make(*a,**kw):
    stage=Path(tempfile.mkdtemp(prefix='v19-owned-pure-stage-',dir='/private/tmp'));stages.append(stage);return str(stage)
   u.tempfile=types.SimpleNamespace(mkdtemp=make)
   packet={'sourceFiles':{'sample.txt':u.source_record('sample.txt')},'scope':'pure synthetic finalization'}
   data=json.dumps(packet).encode();(u.HERE/'INPUTS.json').write_bytes(data)
   try:
    if copy_refusal:
     self.assertEqual(u.execute(hashlib.sha256(data).hexdigest()),1)
     receipt=json.loads((u.HERE/'RESULT.json').read_text());self.assertFalse(receipt['accepted'])
     self.assertEqual(receipt['failure'],'cancelled' if copy_refusal=='cancelled' else 'dependency_copy_deadline')
     self.assertEqual(len(copied),1);self.assertEqual(ran,[])
    elif shadow:
     with self.assertRaises(AttributeError):u.execute(hashlib.sha256(data).hexdigest())
     self.assertFalse((u.HERE/'RESULT.json').exists())
    else:
     self.assertEqual(u.execute(hashlib.sha256(data).hexdigest()),0)
     receipt=json.loads((u.HERE/'RESULT.json').read_text());self.assertTrue(receipt['accepted'])
     self.assertEqual(len(calls),6);self.assertEqual([value for _,value in calls[-3:]],['previous-handler']*3)
     copied=stages[0]/'source/node_modules/pkg/value.js';self.assertNotEqual(copied.stat().st_ino,(work/'node_modules/pkg/value.js').stat().st_ino)
     copied.write_text('changed owned copy');self.assertEqual((work/'node_modules/pkg/value.js').read_text(),'synthetic dependency')
     self.assertEqual((stages[0]/'source/node_modules/.bin/tool').resolve(),copied)
   finally:
    for stage in stages:shutil.rmtree(stage)
 def test_actual_receipt_finalizes_after_rebased_dependency_link(self):self.exercise()
 def test_original_shadow_counterfactual_loses_receipt(self):self.exercise(True)
 def test_dependency_copy_refuses_cancellation_before_next_file(self):self.exercise(copy_refusal='cancelled')
 def test_dependency_copy_refuses_deadline_before_next_file(self):self.exercise(copy_refusal='deadline')

if __name__=='__main__':unittest.main()
