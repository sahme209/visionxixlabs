"""Synthetic in-memory archive tests. Never extracts or executes source."""
import gzip
import hashlib
import importlib.util
import io
from pathlib import Path
import tarfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('axiom_archive_reader',Path(__file__).with_name('reader.py'))
reader=importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)
ROOT=reader.ROOT

def blob(data):
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()

def inventory(files=None):
    files=files or {'src/main.rs':b'// synthetic source\n'}
    return {name:{'sha':blob(data),'size':len(data),'mode':'100644'} for name,data in files.items()}

def entry(name,data=b'',kind=tarfile.REGTYPE,mode=0o644,link=''):
    info=tarfile.TarInfo(name)
    info.type=kind
    info.mode=mode
    info.size=len(data) if kind in [tarfile.REGTYPE,tarfile.XHDTYPE,tarfile.XGLTYPE] else 0
    info.linkname=link
    return info,data

def archive(entries=None,fmt=tarfile.USTAR_FORMAT):
    entries=entries if entries is not None else [entry(ROOT,b'',tarfile.DIRTYPE,0o755),entry(ROOT+'/src',b'',tarfile.DIRTYPE,0o755),entry(ROOT+'/src/main.rs',b'// synthetic source\n')]
    out=io.BytesIO()
    with tarfile.open(fileobj=out,mode='w',format=fmt) as tar:
        for info,data in entries:
            tar.addfile(info,io.BytesIO(data))
    return gzip.compress(out.getvalue(),mtime=0)

class ReaderTests(unittest.TestCase):
    def reject(self,value,inv=None):
        with self.assertRaises(ValueError):
            reader.validate_against_inventory(value,inv if inv is not None else inventory())

    def test_valid_archive_returns_exact_regular_files_without_extracting(self):
        self.assertEqual(reader.validate_against_inventory(archive(),inventory()),{'src/main.rs':b'// synthetic source\n'})

    def test_valid_executable_mode_is_bound_to_inventory(self):
        files={'script.sh':b'#!/bin/sh\nexit 0\n'}
        inv=inventory(files);inv['script.sh']['mode']='100755'
        value=archive([entry(ROOT,b'',tarfile.DIRTYPE,0o755),entry(ROOT+'/script.sh',files['script.sh'],mode=0o755)])
        self.assertEqual(reader.validate_against_inventory(value,inv),files)

    def test_wrong_content_hash_is_rejected(self):
        self.reject(archive([entry(ROOT+'/src/main.rs',b'// altered source!!\n')]))

    def test_recorded_size_mismatch_is_rejected(self):
        inv=inventory();inv['src/main.rs']['size']+=1
        self.reject(archive(),inv)

    def test_missing_and_extra_files_are_rejected(self):
        self.reject(archive([]))
        self.reject(archive([entry(ROOT+'/src/main.rs',b'// synthetic source\n'),entry(ROOT+'/extra',b'x')]))

    def test_duplicate_regular_files_are_rejected(self):
        file=entry(ROOT+'/src/main.rs',b'// synthetic source\n')
        self.reject(archive([file,file]))

    def test_wrong_root_and_noncanonical_paths_are_rejected(self):
        for name in ['other/src/main.rs','/'+ROOT+'/src/main.rs',ROOT+'/../src/main.rs',ROOT+'/src/../src/main.rs',ROOT+'/./src/main.rs',ROOT+'//src/main.rs',ROOT+'/src\\main.rs']:
            with self.subTest(name=name):self.reject(archive([entry(name,b'// synthetic source\n')]))

    def test_symlinks_hardlinks_and_special_files_are_rejected(self):
        for kind in [tarfile.SYMTYPE,tarfile.LNKTYPE,tarfile.FIFOTYPE,tarfile.CHRTYPE,tarfile.BLKTYPE]:
            with self.subTest(kind=kind):self.reject(archive([entry(ROOT+'/src/main.rs',kind=kind,link='../../outside')]))

    def test_pax_and_global_headers_are_rejected_not_silently_normalized(self):
        for kind in [tarfile.XHDTYPE,tarfile.XGLTYPE]:
            with self.subTest(kind=kind):self.reject(archive([entry(ROOT+'/meta',kind=kind),entry(ROOT+'/src/main.rs',b'// synthetic source\n')]))
        info,data=entry(ROOT+'/src/main.rs',b'// synthetic source\n');info.pax_headers={'comment':'unreviewed metadata'}
        self.reject(archive([(info,data)],tarfile.PAX_FORMAT))


    def test_only_exact_first_global_commit_comment_is_accepted(self):
        commit='371058f8f6a1786d4a4ab3eed9f5f2f16eea7777'
        text=' comment='+commit+'\n';length=len(text)+2
        while len(str(length))+len(text)!=length:length=len(str(length))+len(text)
        payload=(str(length)+text).encode()
        header=entry('pax_global_header',payload,tarfile.XGLTYPE)
        regular=entry(ROOT+'/src/main.rs',b'// synthetic source\n')
        self.assertEqual(reader.validate_against_inventory(archive([header,regular]),inventory()),{'src/main.rs':b'// synthetic source\n'})
        self.reject(archive([regular,header]))
        self.reject(archive([header,header,regular]))

    def test_global_pax_overrides_unknown_keys_bad_lengths_and_size_are_rejected(self):
        commit='371058f8f6a1786d4a4ab3eed9f5f2f16eea7777'
        def pax(key,value):
            text=' '+key+'='+value+'\n';length=len(text)+2
            while len(str(length))+len(text)!=length:length=len(str(length))+len(text)
            return (str(length)+text).encode()
        good=pax('comment',commit)
        payloads=[pax('comment','0'*40),good+good,b'999 comment=x\n',b'0 comment=x\n',b'059 comment='+commit.encode()+b'\n',good+b'junk',b'x'*1025]
        payloads += [good+pax(key,'unexpected') for key in ['path','size','linkpath','mode','uid','gid','mtime','unknown']]
        for payload in payloads:
            with self.subTest(payload=payload[:40]):self.reject(archive([entry('pax_global_header',payload,tarfile.XGLTYPE),entry(ROOT+'/src/main.rs',b'// synthetic source\n')]))

    def test_gnu_longname_extension_is_rejected(self):
        self.reject(archive([entry(ROOT+'/'+'a'*110,b'x')],tarfile.GNU_FORMAT))

    def test_executable_mismatch_and_privileged_mode_are_rejected(self):
        for mode in [0o755,0o4644,0o2644]:
            with self.subTest(mode=mode):self.reject(archive([entry(ROOT+'/src/main.rs',b'// synthetic source\n',mode=mode)]))

    def test_ordinary_archive_mode_is_not_installed_or_mistaken_for_git_identity(self):
        value=archive([entry(ROOT+'/src/main.rs',b'// synthetic source\n',mode=0o664)])
        self.assertEqual(reader.validate_against_inventory(value,inventory()),{'src/main.rs':b'// synthetic source\n'})

    def test_unexpected_directory_is_rejected(self):
        self.reject(archive([entry(ROOT+'/unrelated',kind=tarfile.DIRTYPE),entry(ROOT+'/src/main.rs',b'// synthetic source\n')]))

    def test_entry_count_is_bounded(self):
        with patch.object(reader,'MAX_ENTRIES',2):self.reject(archive())

    def test_path_byte_count_is_bounded(self):
        with patch.object(reader,'MAX_PATH_BYTES',len(ROOT.encode())+4):self.reject(archive())

    def test_compressed_body_is_bounded(self):
        value=archive()
        with patch.object(reader,'MAX_COMPRESSED',len(value)-1):self.reject(value)

    def test_total_expanded_stream_is_bounded_not_just_regular_payloads(self):
        value=archive()
        with patch.object(reader,'MAX_EXPANDED',1024):self.reject(value)

    def test_gzip_errors_truncation_and_trailing_members_are_rejected(self):
        value=archive()
        for bad in [b'not gzip',value[:-8],value+b'garbage',value+gzip.compress(b'x')]:
            with self.subTest(length=len(bad)):self.reject(bad)

    def test_tar_checksum_error_is_rejected(self):
        raw=bytearray(gzip.decompress(archive()));raw[0]^=1
        self.reject(gzip.compress(raw,mtime=0))

    def test_truncated_tar_payload_is_rejected(self):
        raw=gzip.decompress(archive())
        self.reject(gzip.compress(raw[:1700],mtime=0))

if __name__=='__main__':unittest.main()
