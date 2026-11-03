"""Synthetic Mach-O loader metadata only; no native execution/qualification."""
import struct, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
from governance_local_issuer import native_linkage as native

def string_command(kind, value, header=24):
 raw=value.encode()+b'\0'; size=(header+len(raw)+7)//8*8
 return struct.pack('<III',kind,size,header)+bytes(header-12)+raw+bytes(size-header-len(raw))
def image(*commands, kind=6):
 body=b''.join(commands)
 return struct.pack('<IiiIIIII',0xfeedfacf,0x100000c,0,kind,len(commands),len(body),0,0)+body
def universal(arm, duplicate=False):
 foreign=b'FOREIGN SLICE NOT INSPECTED'+bytes(40)
 offset1=64;offset2=offset1+len(foreign);offset2=(offset2+7)//8*8
 descriptors=[(0x1000007,3,offset1,len(foreign),3),(0x100000c,0,offset2,len(arm),3)]
 if duplicate:descriptors[0]=(0x100000c,0,offset1,len(foreign),3)
 header=struct.pack('>II',0xcafebabe,2)+b''.join(struct.pack('>iiIII',*d)for d in descriptors)
 return header+bytes(offset1-len(header))+foreign+bytes(offset2-offset1-len(foreign))+arm
class NativeLinkage(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name).resolve()
  self.host=patch.object(native,'host_observation',return_value={'osBuild':'SIMULATED','architecture':'arm64','apfsSnapshot':False});self.host.start();self.addCleanup(self.host.stop)
 def put(self,name,*commands,kind=6):
  p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(image(*commands,kind=kind));return p
 def collect(self):return native.collect_native_prerequisites(self.root)
 def test_install_id_is_not_a_dependency_or_a_host_requirement(self):
  self.put('lib.dylib',string_command(0xd,'/old/build/private/lib.dylib'),string_command(0xc,'/usr/lib/libSystem.B.dylib'))
  result=self.collect();self.assertEqual(result['unresolved'],[])
  self.assertEqual(result['systemInstallNames'],['/usr/lib/libSystem.B.dylib'])
  self.assertEqual(result['machOFiles'][0]['installNames'],['/usr/lib/libSystem.B.dylib'])
  self.assertEqual(result['machOFiles'][0]['installId'],'/old/build/private/lib.dylib')
  self.assertEqual(result['runtimeQualification'],'unavailable')
 def test_own_loader_rpath_resolves_exact_packaged_target(self):
  self.put('sharp/addon.node',string_command(0x8000001c,'@loader_path/../lib',12),string_command(0xc,'@rpath/libvips.dylib'),kind=8)
  self.put('lib/libvips.dylib',string_command(0xd,'@rpath/libvips.dylib'))
  result=self.collect();self.assertEqual(result['unresolved'],[])
  entry=next(x for x in result['machOFiles']if x['path']=='sharp/addon.node')
  self.assertEqual(entry['resolvedDependencies'],[{'installName':'@rpath/libvips.dylib','path':'lib/libvips.dylib'}])
 def test_sharp_unused_escape_is_recorded_not_a_load_dependency(self):
  self.put('sharp/addon.node',string_command(0x8000001c,'@loader_path/../lib',12),string_command(0x8000001c,'@loader_path/../../external',12),string_command(0xc,'@rpath/libvips.dylib'),kind=8)
  self.put('lib/libvips.dylib',string_command(0xd,'@rpath/libvips.dylib'))
  result=self.collect();self.assertEqual(result['unresolved'],[])
  entry=next(x for x in result['machOFiles']if x['path']=='sharp/addon.node')
  self.assertEqual(entry['resolvedDependencies'],[{'installName':'@rpath/libvips.dylib','path':'lib/libvips.dylib'}])
  self.assertEqual(entry['unqualifiedSearchContexts'],[{'rpath':'@loader_path/../../external','reason':'outside_package'}])
  self.assertEqual(result['nativeSearchContextQualification'],'unavailable')
  self.assertFalse(result['canConstructIssuerIdentity'])
 def test_escape_and_inherited_rpath_refuse(self):
  for rpath in ('@loader_path/../../outside','@executable_path/lib',None):
   with self.subTest(rpath=rpath):
    commands=[] if rpath is None else [string_command(0x8000001c,rpath,12)]
    self.put('addon.node',*commands,string_command(0xc,'@rpath/lib.dylib'),kind=8)
    self.assertTrue(self.collect()['unresolved'])
 def test_two_distinct_existing_rpath_targets_refuse(self):
  self.put('addon.node',string_command(0x8000001c,'@loader_path/a',12),string_command(0x8000001c,'@loader_path/b',12),string_command(0xc,'@rpath/lib.dylib'),kind=8)
  for d in ('a','b'):self.put(d+'/lib.dylib',string_command(0xd,'@rpath/lib.dylib'))
  self.assertTrue(any(x['reason']=='ambiguous_rpath'for x in self.collect()['unresolved']))
 def test_external_symlink_is_not_loader_authority(self):
  with tempfile.TemporaryDirectory()as outside:
   target=Path(outside)/'lib.dylib';target.write_bytes(image(string_command(0xd,'lib')))
   (self.root/'lib.dylib').symlink_to(target)
   self.put('addon.node',string_command(0xc,'@loader_path/lib.dylib'),kind=8)
   self.assertTrue(self.collect()['unresolved'])
 def test_embedded_environment_and_unknown_commands_refuse(self):
  for command in (string_command(0x27,'DYLD_INSERT_LIBRARIES=x',12),struct.pack('<II',0x777,8)):
   self.put('addon.node',command,kind=8);self.assertTrue(self.collect()['unresolved'])
 def test_malformed_and_unsupported_architecture_refuse(self):
  path=self.put('addon.node',string_command(0xc,'/usr/lib/libSystem.B.dylib'),kind=8)
  raw=bytearray(path.read_bytes());raw[4:8]=struct.pack('<i',7);path.write_bytes(raw)
  self.assertTrue(self.collect()['unresolved'])
  path.write_bytes(image(struct.pack('<II',0xc,8),kind=8));self.assertTrue(self.collect()['unresolved'])
 def test_fifo_never_opened_and_hardlinked_image_refuses(self):
  import os
  os.mkfifo(self.root/'pipe')
  self.assertTrue(self.collect()['unresolved'])
  (self.root/'pipe').unlink()
  path=self.put('lib.dylib',string_command(0xd,'lib'))
  os.link(path,self.root/'alias.dylib');self.assertTrue(self.collect()['unresolved'])
 def test_metadata_count_and_tree_limits_refuse(self):
  self.put('lib.dylib',string_command(0xd,'lib'))
  with patch.object(native,'MAX_MACH_FILES',0):self.assertTrue(self.collect()['unresolved'])
  with patch.object(native,'MAX_FILES',0):
   with self.assertRaises(native.PackageUnavailable):self.collect()
 def test_direct_loader_target_and_internal_alias_resolve(self):
  self.put('lib/lib.dylib',string_command(0xd,'lib'))
  (self.root/'alias.dylib').symlink_to('lib/lib.dylib')
  self.put('addon.node',string_command(0xc,'@loader_path/alias.dylib'),kind=8)
  self.assertEqual(self.collect()['unresolved'],[])
 def test_unreadable_tree_cannot_silently_omit_native_files(self):
  with patch.object(native.os,'scandir',side_effect=PermissionError('SIMULATED')):
   with self.assertRaises(native.PackageUnavailable):self.collect()
 def test_escaping_search_and_symlink_never_inspect_external_target(self):
  with tempfile.TemporaryDirectory()as outside:
   outside=Path(outside).resolve();target=outside/'lib.dylib';target.write_bytes(image(string_command(0xd,'lib')))
   (self.root/'alias').symlink_to(outside)
   self.put('addon.node',string_command(0x8000001c,'@loader_path/alias',12),string_command(0xc,'@rpath/lib.dylib'),kind=8)
   original=Path.lstat
   def guarded(path,*args,**kwargs):
    if path==outside or outside in path.parents:raise AssertionError('external lstat')
    return original(path,*args,**kwargs)
   with patch.object(Path,'lstat',guarded):result=self.collect()
   self.assertTrue(result['unresolved'])
 def test_universal_arm64_slice_preserves_full_hash_and_all_descriptors(self):
  import hashlib
  raw=universal(image(string_command(0xc,'/usr/lib/libSystem.B.dylib'),kind=8));(self.root/'fsevents.node').write_bytes(raw)
  result=self.collect();self.assertEqual(result['unresolved'],[]);entry=result['machOFiles'][0]
  self.assertEqual(entry['sha256'],hashlib.sha256(raw).hexdigest());self.assertEqual(entry['size'],len(raw))
  self.assertEqual(len(entry['architectures']),2);self.assertEqual(entry['selectedArchitecture']['cpuType'],0x100000c)
  self.assertEqual(entry['otherArchitecturesQualification'],'not_inspected')
  self.assertEqual(result['runtimeQualification'],'unavailable')
 def test_universal_duplicate_overlap_bounds_and_missing_arm64_refuse(self):
  raw=universal(image(string_command(0xc,'/usr/lib/libSystem.B.dylib'),kind=8))
  variants=[universal(image(string_command(0xc,'/usr/lib/libSystem.B.dylib'),kind=8),True)]
  for pos,value in ((36,64),(40,0xffffffff),(44,31),(28,0x1000007)):
   changed=bytearray(raw);struct.pack_into('>I',changed,pos,value);variants.append(bytes(changed))
  for variant in variants:
   with self.subTest(header=variant[:48].hex()):
    (self.root/'fsevents.node').write_bytes(variant);self.assertTrue(self.collect()['unresolved'])
 def test_non_native_files_are_not_reported(self):
  (self.root/'data').write_text('not native');self.assertEqual(self.collect()['machOFiles'],[])
if __name__=='__main__':unittest.main()
