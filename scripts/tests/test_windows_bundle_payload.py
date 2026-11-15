"""Pure full-file comparisons for pinned Tauri per-package binary stamping."""
import hashlib,importlib.util,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
SOURCE=Path(__file__).resolve().parents[1]/'windows_installed_acceptance.py'
spec=importlib.util.spec_from_file_location('windows_payload',SOURCE);c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
PROOF={name:{'version':'2.12.4','integrity':'sha512-synthetic-lock-integrity','payloadSha256':'a'*64} for name in ('@tauri-apps/cli','@tauri-apps/cli-win32-x64-msvc')}
MARKER=b'__TAURI_BUNDLE_TYPE_VAR_UNK'
RAW=b'MZ-synthetic-header-prefix:'+MARKER+b'-unmodified-middle-'+MARKER+b'-tail'
def packaged(kind):
 data=bytearray(RAW);offset=RAW.index(MARKER);data[offset:offset+len(MARKER)]=b'__TAURI_BUNDLE_TYPE_VAR_'+({'msi':b'MSI','nsis':b'NSS'}[kind]);return bytes(data)
class BundlePayload(unittest.TestCase):
 def expectations(self,folder):
  p=Path(folder)/'raw.exe';p.write_bytes(RAW);return c.bundled_payload_expectations(p,Path(folder),PROOF)
 def test_observed_old_single_raw_hash_rejects_legitimate_packaged_images(self):
  # Counterfactual RED: original controller compared installed image to this raw
  # restored binary; both legitimate full-file package images must fail it.
  for kind in ('msi','nsis'):
   with self.assertRaises(AssertionError):self.assertEqual(hashlib.sha256(packaged(kind)).hexdigest(),hashlib.sha256(RAW).hexdigest())
 def test_exact_pinned_first_marker_per_format_full_file_hashes(self):
  with tempfile.TemporaryDirectory() as folder:
   result=self.expectations(folder);self.assertEqual(result['rawInputSha256'],hashlib.sha256(RAW).hexdigest());self.assertEqual(result['markerOffset'],RAW.index(MARKER));self.assertEqual(result['markerBytes'],27)
   for kind in ('msi','nsis'):
    self.assertEqual(c.format_payload_hash(result['formatExpectedSha256'],kind),hashlib.sha256(packaged(kind)).hexdigest());self.assertEqual(packaged(kind).count(MARKER),1)
   self.assertNotEqual(result['formatExpectedSha256']['msi'],result['formatExpectedSha256']['nsis'])
 def test_missing_marker_size_outside_root_and_unqualified_source_refused(self):
  with tempfile.TemporaryDirectory() as folder,tempfile.TemporaryDirectory() as other:
   root=Path(folder);p=root/'raw.exe';p.write_bytes(b'no-marker')
   with self.assertRaisesRegex(RuntimeError,'payload_bundle_marker_missing'):c.bundled_payload_expectations(p,root,PROOF)
   p.write_bytes(RAW)
   with patch.object(c,'MAX_BUNDLE_PAYLOAD_BYTES',len(RAW)-1),self.assertRaisesRegex(RuntimeError,'payload_patch_size_refused'):c.bundled_payload_expectations(p,root,PROOF)
   with self.assertRaisesRegex(RuntimeError,'artifact_outside_owned_root'):c.bundled_payload_expectations(p,Path(other),PROOF)
   for bad in [{},{**PROOF,'unexpected':{}},{name:{**row,'version':'2.12.3'} for name,row in PROOF.items()},{name:{**row,'payloadSha256':'unhashed'} for name,row in PROOF.items()}]:
    with self.assertRaisesRegex(RuntimeError,'payload_patch_source_unqualified'):c.bundled_payload_expectations(p,root,bad)
 def test_invalid_format_map_refused(self):
  for mapping,kind in [({'msi':'a'*64},'msi'),({'msi':'a'*64,'nsis':'b'*64},'zip'),({'msi':'a'*64,'nsis':'bad'},'msi')]:
   with self.assertRaisesRegex(RuntimeError,'payload_format_expectation_invalid'):c.format_payload_hash(mapping,kind)
 def install_case(self,kind,image,expected_kind=None):
  with tempfile.TemporaryDirectory() as folder:
   base=Path(folder);expect=self.expectations(folder);installer=base/('candidate.'+('msi' if kind=='msi' else 'exe'));installer.write_bytes(b'installer');receipt={'installations':[]};calls=[]
   expected=c.format_payload_hash(expect['formatExpectedSha256'],expected_kind or kind)
   class Runner:
    deadline=0;output=base
    def run(self,label,args,cwd,seconds,**kwargs):
     calls.append(label)
     if label=='install-'+kind:
      p=base/('installed-'+kind);p.mkdir();(p/'axiom-desktop.exe').write_bytes(image)
      if kind=='nsis':(p/'uninstall.exe').write_bytes(b'owned-uninstaller')
     if label=='installed-metadata-'+kind:return json.dumps({'ProductVersion':'0.1.23','machine':'AMD64'})
     if label=='uninstall-'+kind:
      p=base/('installed-'+kind)
      for f in p.iterdir():
       if f.name!='uninstall.exe':f.unlink()
     return ''
   metadata={'sha256':c.digest(installer),'ProductCode':'synthetic'}
   good=image==packaged(expected_kind or kind)
   with patch.object(c,'protocol_state',side_effect=[[],['synthetic-protocol'],[]] if good else [[],[]]),patch.object(c,'protocol_args_match',return_value=True),patch.object(c,'parse_windows_command',return_value=[]),patch.object(c,'product_state',side_effect=[-1,5,-1] if kind=='msi' else []),patch.object(c,'require_webview_runtime',return_value={}),patch.object(c,'require_pe_role'):
    if good:c.install_one(Runner(),{'msiexec.exe':'fixed','pwsh.exe':'fixed'},base,kind,installer,metadata,'0.1.23',expected,receipt)
    else:
     with self.assertRaisesRegex(RuntimeError,'installed_payload_mismatch'):c.install_one(Runner(),{'msiexec.exe':'fixed','pwsh.exe':'fixed'},base,kind,installer,metadata,'0.1.23',expected,receipt)
   row=receipt['installations'][0];self.assertEqual(row['installedPayloadSha256'],hashlib.sha256(image).hexdigest());self.assertEqual(row['expectedPayloadSha256'],expected);self.assertTrue(row['uninstallConfirmed']);self.assertEqual(row['installConfirmed'],good)
 def test_actual_install_gate_accepts_msi_full_patched_image(self):self.install_case('msi',packaged('msi'))
 def test_actual_install_gate_accepts_nsis_full_patched_image(self):self.install_case('nsis',packaged('nsis'))
 def test_actual_install_gate_refuses_wrong_format_and_unrelated_byte_flip(self):
  self.install_case('msi',packaged('nsis'));changed=bytearray(packaged('msi'));changed[-1]^=1;self.install_case('msi',bytes(changed))
 def test_clean_and_all_upgrade_paths_use_explicit_format_map(self):
  source=SOURCE.read_text();self.assertIn('candidate_metadata[kind], version, format_payload_hash(payload_hashes, kind), receipt)',source);self.assertIn('candidate_metadata, version, payload_hashes, receipt)',source)
  upgrade=source[source.index('def run_upgrade_cycle('):source.index('def protocol_state(')];self.assertIn("kind = 'msi' if recipe == 'msi-major-upgrade' else 'nsis'",upgrade);self.assertIn('payload_hash = format_payload_hash(payload_hashes, kind)',upgrade)
if __name__=='__main__':unittest.main()
