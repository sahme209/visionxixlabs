"""SOURCE CONTRACTS ONLY. No C compiler, reference codec/model, native API or
worker is executed. These checks do not claim native codec/worker behavior."""
from pathlib import Path
import re,unittest
ROOT=Path(__file__).resolve().parents[2]
D=ROOT/'packages/verified-issuer-runtime/linux'
class TimeWorkerSourceContracts(unittest.TestCase):
 def setUp(self):self.h=(D/'time_worker_protocol.h').read_text();self.c=(D/'time_worker_protocol.c').read_text();self.w=(D/'time_worker.c').read_text()
 def test_closed_caps_and_signatures(self):
  for value in ['AXIOM_WORKER_CONTEXT_MAX 512u','AXIOM_WORKER_HEADER_MAX 512u','AXIOM_WORKER_FRAME_MAX 4608u','AXIOM_WORKER_GENERATION_MAX 128u','axiom_worker_context_encode','axiom_worker_context_decode','axiom_worker_capture_encode','axiom_worker_capture_decode']:self.assertIn(value,self.h)
 def test_canonical_numbers_are_checked_before_multiply(self):
  for value in ["s.length>1 && s.data[0]=='0'",'value>(maximum-digit)/10','UINT32_MAX','UINT64_MAX','INT64_MAX']:self.assertIn(value,self.c)
 def test_parent_identity_reuses_strict_record_validator(self):
  self.assertIn('int axiom_worker_record_identity(',self.h)
  self.assertIn('int axiom_worker_record_identity(',self.c)
  self.assertIn('validate_record(record,length,&context,&p,&m)',self.c)
  self.assertIn('*publication=p;*marker=m',self.c)
 def test_exact_context_grammar_and_eof(self):
  for value in ['end_of_input!=1','take_lines(bytes,length,7,lines,&used)','used!=length','AXIOM_WORKER_CONTEXT_MAGIC','span_equal(lines[6],"END")']:self.assertIn(value,self.c)
 def test_capture_has_exact_header_body_and_record_validation(self):
  for value in ['take_lines(bytes,length,11,lines,&used)','used>AXIOM_WORKER_HEADER_MAX','length-used!=record_length','validate_record','record_publication!=value.publication','record_marker!=value.disruption_marker','AXIOM_TIME_MAGIC','AXIOM_TIME_LAYOUT']:self.assertIn(value,self.c)
 def test_outputs_never_import_native_authority(self):
  self.assertIn('out->held_fd=-1',self.c);self.assertIn('out->time_authority=0',self.c)
  for banned in ['open(','openat(','close(','read(','write(','qualified','napi_']:self.assertNotIn(banned,self.c)
 def test_encode_order_and_no_c_struct_serialization(self):
  self.assertIn('AXIOM_WORKER_CONTEXT_MAGIC "\\n%s\\n%',self.c)
  self.assertIn('AXIOM_WORKER_CAPTURE_MAGIC "\\n%zu\\n%',self.c)
  self.assertIn('memcpy(buffer+header,capture->record,capture->bytes)',self.c)
  self.assertNotRegex(self.c,r'memcpy\([^;]*sizeof\(\*capture\)')
 def test_worker_fixed_fds_and_one_capture_release(self):
  for value in ['WORKER_DIRECTORY_FD 3','WORKER_SOURCE_FD 4','WORKER_RESULT_FD 5','WORKER_BOOTSTRAP_FD 6','AXIOM_WORKER_CONTEXT_MAX+1','AXIOM_WORKER_FRAME_MAX']:self.assertIn(value,self.w)
  self.assertEqual(self.w.count('axiom_time_capture_v2('),1);self.assertEqual(self.w.count('axiom_time_capture_release('),1)
 def test_worker_closed_failure_no_logs_or_arguments(self):
  self.assertIn('int main(void)',self.w);self.assertIn('_exit(70)',self.w)
  for banned in ['printf(','perror(','fprintf(','getenv(','argv','system(','exec']:self.assertNotIn(banned,self.w)
 def test_actual_capture_interface_reused_not_reimplemented(self):
  self.assertIn('context.directory_fd=WORKER_DIRECTORY_FD',self.w)
  self.assertIn('context.source_fd=WORKER_SOURCE_FD',self.w)
  self.assertIn('axiom_worker_capture_encode(',self.w)
  self.assertNotIn('clock_gettime(',self.w)
if __name__=='__main__':unittest.main()
