import importlib.util,unittest,copy
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('compiled_smoke_controller',Path(__file__).with_name('run.py'))
controller=importlib.util.module_from_spec(spec)
with patch('subprocess.Popen') as launch:
 spec.loader.exec_module(controller)
 if launch.called:raise AssertionError('import must not launch compiled test')
class ReportValidation(unittest.TestCase):
 def valid(self):return {'scope':'compiled userland POST ordinary isolated test, not Next HTTP server or native issuer qualification','sourceRevision':'201f5e77e70ba261e57958247f77a0fe23567824','records':[{'label':x,'status':503,'code':'ai.public_admission_unavailable'} for x in ['valid','malformed','claims']],'rateLimit':{'initialRefusals':10,'eleventhStatus':429},'network':'kernel denied','credentials':'absent','runtimeQualification':'unavailable','executionAuthorized':False}
 def test_rejects_empty_and_wrong_json_types(self):
  for value in [{},[],False,0,None,'']:
   with self.subTest(value=value):self.assertFalse(controller.valid_report(value))
 def test_rejects_incomplete_or_wrong_outcomes(self):
  for key,value in [('records',[]),('rateLimit',{'initialRefusals':10,'eleventhStatus':200}),('sourceRevision','other'),('runtimeQualification','qualified'),('executionAuthorized',True),('executionAuthorized',0)]:
   candidate=self.valid();candidate[key]=value
   with self.subTest(key=key,value=value):self.assertFalse(controller.valid_report(candidate))
 def test_accepts_only_complete_expected_unqualified_report(self):self.assertTrue(controller.valid_report(self.valid()))
if __name__=='__main__':unittest.main()
