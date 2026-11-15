import importlib.util,signal,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('framer_compile',Path(__file__).with_name('compile_website.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class Owner:
 def __init__(self):self.cancelled=False
 def signal(self,*_):self.cancelled=True
 def run(self,*args):
  # Emulate delivery through the actual registered parent signal handler.
  signal.getsignal(signal.SIGTERM)(signal.SIGTERM,None)
  return {'exitCode':None,'reason':'cancelled','cleanupConfirmed':True}
class CompileSignals(unittest.TestCase):
 def test_cancellation_reaches_owner_and_restores_handlers(self):
  old={s:signal.getsignal(s) for s in (signal.SIGTERM,signal.SIGHUP,signal.SIGINT)};owner=Owner()
  result=module.run_owned(owner,[],Path('/tmp'),{},Path('/tmp/not-used'))
  self.assertTrue(owner.cancelled);self.assertEqual(result['reason'],'cancelled')
  self.assertEqual({s:signal.getsignal(s) for s in old},old)
 def test_exception_restores_all_handlers(self):
  old={s:signal.getsignal(s) for s in (signal.SIGTERM,signal.SIGHUP,signal.SIGINT)};owner=Owner()
  with patch.object(owner,'run',side_effect=RuntimeError('synthetic')):
   with self.assertRaises(RuntimeError):module.run_owned(owner,[],Path('/tmp'),{},Path('/tmp/not-used'))
  self.assertEqual({s:signal.getsignal(s) for s in old},old)
if __name__=='__main__':unittest.main()
