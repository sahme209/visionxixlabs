"""One approved build-only IPC compatibility batch. Governance outputs never launch."""
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import signal
import time

REPOSITORY = 'sahme209/visionxixlabs'
BRANCH = 'codex/governance-live-qualification-setup'
TARGET = 'x86_64-unknown-linux-gnu'
PACKET = 'docs/recovery/2026-11-13/real-governance-qualification/design/linux-compiler-validation/BUILD-SYMBOL-FORMAT-INPUT-PACKET.json'
PR_NUMBER=331
BEFORE='8aefbd599cd921eff685295ae8eacb89e59499a4'
OBSERVED_INPUT_HEAD='207cf145a15b87c07206027fc2e2f08511b3523a'
PACKET_KIND='one-sync-pr331-build-symbol-format-v1'
HEX = re.compile(r'[0-9a-f]{40}\Z')
NATIVE = frozenset(['-lgcc_s','-lutil','-lrt','-lpthread','-lm','-ldl','-lc'])

def need(value, reason='linux_compile_refused'):
    if not value: raise ValueError(reason)

def validate_event(event, name, attempt):
    need(name=='pull_request' and attempt=='1' and isinstance(event,dict) and event.get('action')=='synchronize')
    need(event.get('number')==PR_NUMBER and event.get('before')==BEFORE)
    repo=event.get('repository',{});pr=event.get('pull_request',{})
    need(isinstance(repo,dict) and isinstance(pr,dict) and pr.get('number')==PR_NUMBER)
    head=pr.get('head',{});base=pr.get('base',{})
    need(isinstance(head,dict) and isinstance(base,dict))
    need(repo.get('full_name')==REPOSITORY and repo.get('private') is False)
    need(base.get('ref')=='main' and base.get('repo',{}).get('full_name')==REPOSITORY)
    need(head.get('ref')==BRANCH and head.get('repo',{}).get('full_name')==REPOSITORY)
    sha=head.get('sha','');need(isinstance(sha,str) and HEX.fullmatch(sha) and sha!=BEFORE and event.get('after')==sha)
    return sha

def restricted_command(launcher,argv):
    need(isinstance(argv,list) and bool(argv) and all(isinstance(v,str) and '\0' not in v for v in argv))
    need(Path(launcher).is_absolute() and Path(argv[0]).is_absolute())
    return [str(launcher),'--',*argv]

def verify_frozen_files(files):
    for path,digest in files.items():
        need(path.is_file() and not path.is_symlink() and hashlib.sha256(path.read_bytes()).hexdigest()==digest,'frozen_file_changed')

def add_frozen(files,path,expected=None):
    path=Path(path)
    need(path.is_file() and not path.is_symlink(),'frozen_file_missing')
    digest=hashlib.sha256(path.read_bytes()).hexdigest()
    need(expected is None or digest==expected,'frozen_file_changed')
    need(path not in files or files[path]==digest,'frozen_file_rebound')
    files[path]=digest


def header_dependencies(text):
    need(len(text)<=1024*1024 and '\0' not in text)
    text=text.replace('\\\n',' ');target,separator,body=text.partition(':')
    need(bool(separator) and bool(target.strip()) and ':' not in body and '\\' not in body)
    values=body.split();need(bool(values) and len(values)<=1024)
    result={}
    for value in values:
        path=Path(value);need(path.is_absolute(),'nonabsolute_header_dependency')
        path=path.resolve(strict=True);need(path.is_file() and not path.is_symlink())
        result[path]=hashlib.sha256(path.read_bytes()).hexdigest()
    return result


def validate_fixture_result(text):
    need(text=='local-file:ok\nchild-exec:ok\nnetwork-denials:ok\nselector-denials:ok\n','restriction_preflight_failed')

def validate_filter_description(text,header):
    need(isinstance(text,str) and len(text)<=1024*1024,'filter_description_oversize')
    def unique(pairs):
        result={}
        for key,value in pairs:
            need(key not in result,'filter_description_duplicate');result[key]=value
        return result
    data=json.loads(text,object_pairs_hook=unique)
    need(isinstance(data,dict) and set(data)=={'format','target','arch','defaultErrno','clone3Errno','allowlist','instructions'},'filter_description_shape')
    need(data['format']==1 and data['target']=='linux-x86_64' and data['arch']==3221225534 and data['defaultErrno']==1 and data['clone3Errno']==38,'filter_description_target')
    block=re.findall(r'^#define AXIOM_ALLOWED_SYSCALLS\(X\)[^\n]*\n([\s\S]*?)(?:\n\n|\Z)',header,re.M)
    need(len(block)==1,'filter_profile_macro_missing')
    names=re.findall(r'\bX\(([a-z][a-z0-9_]*)\)',block[0]);need(bool(names) and len(names)==len(set(names)))
    need(data['allowlist']==names,'filter_profile_mismatch')
    instructions=data['instructions'];need(isinstance(instructions,list) and 0<len(instructions)<=4096,'filter_instructions_missing')
    for instruction in instructions:
        need(isinstance(instruction,dict) and set(instruction)=={'code','jt','jf','k'},'filter_instruction_shape')
        for field,maximum in [('code',65535),('jt',255),('jf',255),('k',4294967295)]:
            value=instruction[field];need(type(value) is int and 0<=value<=maximum,'filter_instruction_range')
    canonical=json.dumps(data,sort_keys=True,separators=(',',':')).encode()
    return {**data,'programSha256':hashlib.sha256(canonical).hexdigest()}


def validate_rust_version(text):
    release = re.findall(r'^release: (\d+)\.(\d+)\.(\d+)$', text, re.M)
    need(len(release) == 1 and tuple(map(int, release[0])) >= (1,85,0))
    need(re.findall(r'^host: (.+)$', text, re.M) == [TARGET])

def native_libraries(text):
    lines = re.findall(r'^note: native-static-libs: (.+)$',text,re.M)
    need(len(lines) == 1)
    tokens = lines[0].split(' ')
    need(tokens and all(t in NATIVE for t in tokens) and '-lc' in tokens)
    return tokens

def verify_feature_tree(text):
    first=text.splitlines()[0] if text.splitlines() else ''
    match=re.fullmatch(r'clock-bound v3\.0\.0-rc\.0 \([^\r\n]+\) ([a-z0-9_,-]+)',first)
    need(match is not None)
    features=set(match.group(1).split(','))
    need('daemon' in features and not features.intersection({'algorithm','test-side-by-side','test-utils','env-filter','time-string-parse'}))

def clean_environment(root, rustc, rustdoc):
    return {'PATH':'/usr/bin:/bin','HOME':str(root/'home'),'CARGO_HOME':str(root/'cargo-home'),
            'CARGO_TARGET_DIR':str(root/'target'),'RUSTC':str(rustc),'RUSTDOC':str(rustdoc),
            'CARGO_NET_RETRY':'0','CARGO_HTTP_TIMEOUT':'30','CARGO_REGISTRIES_CRATES_IO_PROTOCOL':'sparse',
            'CARGO_TERM_COLOR':'never','CARGO_INCREMENTAL':'0','LANG':'C.UTF-8','LC_ALL':'C.UTF-8',
            'GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':'/dev/null','GIT_TERMINAL_PROMPT':'0'}

def core_command(cargo):
    return [str(cargo),'rustc','--locked','--offline','--target',TARGET,'--package','clock-bound','--lib',
            '--no-default-features','--features','daemon','--crate-type','staticlib','--',
            '-C','link-dead-code=yes','--print','native-static-libs']

def link_command(cc, native, static, libraries):
    # Keep the real C reference unresolved in the Rust staticlib, then resolve
    # it here with the exact compiled object. No separate C archive is needed.
    return [str(cc),str(native/'link_only.c'),'-Wl,--no-undefined','-Wl,--whole-archive',str(static),
            '-Wl,--no-whole-archive',str(native/'time_publication.o'),*libraries,'-o',str(native/'link_only')]

def verify_source(source, manifest):
    expected={name:(digest,length) for name,digest,length in manifest}
    actual=set()
    for file in source.rglob('*'):
        need(not file.is_symlink(),'source_symlink')
        if file.is_dir(): continue
        name=file.relative_to(source).as_posix();need(name in expected,'source_extra')
        digest,length=expected[name]
        need(file.is_file() and file.stat().st_size==length and hashlib.sha256(file.read_bytes()).hexdigest()==digest,'source_changed')
        actual.add(name)
    need(actual==set(expected),'source_missing')

# Exact observed names for this pinned producer/toolchain, not a general demangler.
RUST_PRIMARY_SYMBOLS={
    '<clock_bound::daemon::Daemon>::construct_axiom':'_RNvMNtCs2gjoHvujPN_11clock_bound6daemonNtB2_6Daemon15construct_axiom',
    '<clock_bound::daemon::time_publication_adapter::NativeTimePublisher>::publish_precise_then_delegate':'_RNvMs_NtNtCs2gjoHvujPN_11clock_bound6daemon24time_publication_adapterNtB4_19NativeTimePublisher29publish_precise_then_delegate',
}
C_PRIMARY_SYMBOLS=('axiom_time_publish_or_die','axiom_time_capture_v2','axiom_time_capture_current','axiom_time_capture_release')

def verify_symbols(text,raw_text):
    def table(value):
        need(isinstance(value,str) and len(value.encode('utf-8'))<=16*1024*1024,'symbol_table_missing_or_oversize')
        rows={}
        for line in value.splitlines():
            match=re.fullmatch(r'([0-9a-fA-F]+)\s+([A-Za-z])\s+(.+)',line.strip())
            if match:
                address,kind,name=match.groups()
                rows.setdefault(name,[]).append((int(address,16),kind))
        return rows
    demangled=table(text);raw=table(raw_text)
    for name,raw_name in [*((name,name) for name in C_PRIMARY_SYMBOLS),*RUST_PRIMARY_SYMBOLS.items()]:
        actual=demangled.get(name,[]);original=raw.get(raw_name,[])
        need(len(actual)==1 and len(original)==1,'missing_or_ambiguous_primary_symbol')
        need(actual[0][1] in ('T','t') and original[0][1] in ('T','t'),'primary_symbol_not_text')
        need(actual[0]==original[0],'primary_symbol_pair_mismatch')

REQUIRED_INPUTS=frozenset({'docs/recovery/2026-11-13/real-governance-qualification/design/linux-compiler-validation/BUILD-SYMBOL-PRIMARY-EVIDENCE.json','scripts/linux-compile/build_ipc_fixture.c', 'packages/verified-issuer-runtime/linux/vendor/UPSTREAM-TREE.json', 'packages/verified-issuer-runtime/linux/time_publication.h', 'scripts/tests/test_governance_build_ipc_profile.py', 'packages/verified-issuer-runtime/linux/vendor/EXPECTED-PATCHED-SHA256.json', 'docs/recovery/2026-11-13/real-governance-qualification/design/linux-compiler-validation/EVENT-DIRECT-READ-RESULT.json', 'docs/recovery/2026-11-13/real-governance-qualification/design/linux-compiler-validation/EVENT-SYNCHRONIZE-SCHEMA.json', 'packages/verified-issuer-runtime/linux/time_publication.c', 'scripts/tests/test_network_launcher_source.py', 'scripts/tests/test_governance_build_ipc_workflow.py', 'scripts/linux-compile/benign_fixture.c', 'packages/verified-issuer-runtime/linux/vendor/clock-bound-371058f8-source.tar.gz', 'packages/verified-issuer-runtime/linux/vendor/LICENSE.MIT', 'packages/verified-issuer-runtime/linux/vendor/LICENSE.Apache-2.0', 'scripts/tests/test_governance_linux_compile_supervisor.py', 'scripts/linux-compile/build_ipc_fixture.rs', '.github/workflows/linux-build-ipc-compile.yml', 'scripts/governance_rust_spawn_diagnostic.py', 'scripts/governance_linux_compile.py', 'packages/verified-issuer-runtime/linux/vendor/README.md', 'scripts/governance_cargo_error_diagnostic.py', 'scripts/linux-compile/compiler_profile.h', 'packages/verified-issuer-runtime/linux/time_publication_adapter.rs', 'scripts/governance_build_ipc_compile.py', 'scripts/governance_linux_compile_supervisor.py', 'scripts/tests/test_governance_linux_compile_inputs.py', '.github/workflows/linux-time-compile.yml', 'scripts/linux-compile/network_launcher.c', 'scripts/tests/test_governance_build_ipc_compile.py', 'packages/verified-issuer-runtime/linux/clockbound-precise-origin.patch', 'scripts/tests/test_governance_build_ipc_fixtures.py', 'docs/recovery/2026-11-13/real-governance-qualification/design/linux-artifact-integration/archive-read/reader.py', 'scripts/governance_linux_compile_inputs.py', 'docs/recovery/2026-11-13/real-governance-qualification/design/linux-compiler-validation/CARGO-ERROR-OBSERVED-RESULT.json', 'scripts/tests/test_governance_linux_compile.py'})

def verify_packet(repo, frozen=None):
    raw=(repo/PACKET).read_bytes()
    need(frozen is None or raw == frozen,'packet_replaced')
    data=json.loads(raw)
    need(data.get('kind') == PACKET_KIND)
    files=data.get('files');need(isinstance(files,dict) and set(files)==REQUIRED_INPUTS)
    for relative,want in files.items():
        need(isinstance(relative,str) and not relative.startswith('/') and all(x not in ('','.','..') for x in relative.split('/')))
        file=repo/relative
        need(file.is_file() and not file.is_symlink())
        need(file.resolve().is_relative_to(repo.resolve()))
        need(hashlib.sha256(file.read_bytes()).hexdigest() == want, 'packet_input_changed')
    return data

def gated_pipeline(fixtures,tiny,full):
    need(fixtures() is True,'fixtures_not_accepted')
    need(tiny() is True,'tiny_not_accepted')
    need(full() is True,'full_not_accepted')
    return True

def phase_budget(deadline,now,maximum):
    remaining=deadline-now;need(remaining>5,'total_deadline')
    return min(maximum,remaining-5)

def verify_observed_inputs(saved,tools,stdlib,version):
    need(set(tools)=={'rustc','cargo','cc','git','true'} and tools==saved.get('toolSha256'),'observed_tools_changed')
    need(set(stdlib)=={'std','core'} and stdlib==saved.get('standardLibrarySha256'),'observed_stdlib_changed')
    need(version==saved.get('toolchain'),'observed_version_changed')

def collect_symbol_evidence(text):
    """Observe real nm output only; never normalize or accept a Rust path."""
    raw=text.encode('utf-8','strict');need(len(raw)<=16*1024*1024,'symbol_output_limit')
    tokens=('construct_axiom','publish_precise_then_delegate','axiom_time_publish_or_die','axiom_time_capture_v2','axiom_time_capture_current','axiom_time_capture_release')
    rows=[];count=0;size=0;complete=True
    for line in text.splitlines():
        if not any(token in line for token in tokens):continue
        count+=1;length=len(json.dumps(line,ensure_ascii=True).encode('ascii'))+1
        if len(rows)>=256 or length>16384 or size+length>256*1024:
            complete=False;continue
        rows.append(line);size+=length
    return {'stdoutBytes':len(raw),'stdoutSha256':hashlib.sha256(raw).hexdigest(),'candidateCount':count,'candidateRows':rows,'complete':complete}

def render_symbol_receipt(result):
    """Always retain bounded required evidence, independent of bulk metadata."""
    fields=('accepted','head','packetSha256','failurePhase','errorCategory','outputs','elfHeader','rawSymbolEvidence','demangledSymbolEvidence','inputsReceiptSha256','toolchain','standardLibrarySha256','tools','finalSourceChecksPassed','finalFrozenInputsMatched')
    data={key:result[key] for key in fields if key in result}
    data['evidenceKind']='same-artifact-symbol-observation-v1'
    data['filterProgramSha256']=result.get('filter',{}).get('programSha256')
    data['evidenceComplete']=bool(result.get('finalSourceChecksPassed') is True and result.get('finalFrozenInputsMatched') is True and result.get('rawSymbolEvidence',{}).get('complete') is True and result.get('demangledSymbolEvidence',{}).get('complete') is True and isinstance(result.get('outputs'),dict) and len(result['outputs'])==3 and 'ELF64' in result.get('elfHeader','') and 'Advanced Micro Devices X86-64' in result.get('elfHeader',''))
    text=json.dumps(data,sort_keys=True,ensure_ascii=True)
    if len(text.encode('ascii'))>1024*1024:
        return json.dumps({'evidenceKind':data['evidenceKind'],'accepted':False,'evidenceComplete':False,'reason':'wire-limit','head':result.get('head'),'packetSha256':result.get('packetSha256')},sort_keys=True)
    return text

def main():
    # CLI is deliberately limited to the one reviewed hosted PR context.
    need(sys.argv[1:] == ['--approved-ci-once'])
    repo=Path(__file__).resolve().parents[1]
    frozen_packet=(repo/PACKET).read_bytes()
    packet=verify_packet(repo,frozen_packet)
    event_path=Path(os.environ['GITHUB_EVENT_PATH'])
    need(event_path.stat().st_size <= 2*1024*1024)
    head=validate_event(json.loads(event_path.read_text()),os.environ.get('GITHUB_EVENT_NAME'),os.environ.get('GITHUB_RUN_ATTEMPT'))
    need(os.environ.get('AXIOM_PR_HEAD_SHA') == head)
    need(os.environ.get('RUNNER_OS') == 'Linux' and os.environ.get('RUNNER_ARCH') == 'X64')
    root=Path(os.environ['RUNNER_TEMP'])/'axiom-build-ipc-once'
    root.mkdir(mode=0o700) # exclusive: never reuse an earlier attempt's artifacts
    for name in ['home','cargo-home','target','native','logs']: (root/name).mkdir(mode=0o700)
    from governance_linux_compile_supervisor import supervise
    from governance_linux_compile_inputs import materialize
    from governance_rust_spawn_diagnostic import prepare_crate,assert_no_cargo_config
    from governance_cargo_error_diagnostic import sanitize_stderr
    deadline=time.monotonic()+2400
    phase='initialization';records=[]
    # Fixed absolute tools; no rustup install/update/alternate compiler.
    tools={name:Path('/usr/bin')/name for name in ['cc','nm','readelf','git','true']}
    for file in tools.values(): need(file.is_file(), 'missing_installed_tool')
    tools={name:path.resolve(strict=True) for name,path in tools.items()}
    frozen_files={}
    for path in tools.values():add_frozen(frozen_files,path)
    launcher=root/'native/network_launcher'
    rustup=Path.home()/'.cargo/bin/rustup'
    need(rustup.is_file(), 'missing_installed_toolchain')
    rustup=rustup.resolve(strict=True);add_frozen(frozen_files,rustup)
    bootstrap={'PATH':'/usr/bin:/bin','HOME':str(root/'home'),'RUSTUP_HOME':str(Path.home()/'.rustup'),'RUSTUP_AUTO_INSTALL':'0','LANG':'C.UTF-8'}
    env=bootstrap
    def run(label, argv, *, timeout=30, isolated=False, cwd=repo):
        nonlocal phase
        phase=label
        budget=phase_budget(deadline,time.monotonic(),timeout)
        verify_packet(repo,frozen_packet);verify_frozen_files(frozen_files)
        command=restricted_command(launcher,argv) if isolated else argv
        stdout=root/'logs'/(label+'.stdout');stderr=root/'logs'/(label+'.stderr')
        result=supervise(command,cwd=cwd,env=env,stdout_path=stdout,stderr_path=stderr,timeout_seconds=budget,max_output_bytes=16*1024*1024,cleanup_seconds=5)
        records.append({'phase':label,'command':command,'result':result})
        verify_packet(repo,frozen_packet);verify_frozen_files(frozen_files)
        print(json.dumps({'phase':label,'status':result['status'],'cleanupConfirmed':result['cleanup_confirmed']}),flush=True)
        if result['status']!='success' or not result['cleanup_confirmed']:
            # Retain only explicitly bounded path-redacted error after confirmed
            # cleanup/currentness. Never echo arbitrary stdout or traceback.
            replacements={str(root):'<OWNED_ROOT>',str(repo):'<CHECKOUT>'}
            if paths:replacements[str(paths['rustc'].parent.parent)]='<TOOLCHAIN>'
            observation=sanitize_stderr(stderr.read_bytes(),result,replacements)
            build_result['failureDiagnostic']=observation
            need(False,'phase_failed:'+label)
        return stdout.read_text(errors='strict'),stderr.read_text(errors='strict')
    build_result={'accepted':False,'head':head,'packetSha256':hashlib.sha256(frozen_packet).hexdigest(),'records':records,'runtimeLaunched':False,'governanceEnabled':False};result=build_result
    paths={}
    def stop_on_term(_signal,_frame):
        raise SystemExit('linux_compile_cancelled')
    previous_term=signal.signal(signal.SIGTERM,stop_on_term)
    try:
        paths={}
        for name in ['rustc','cargo','rustdoc']:
            value,_=run('locate-'+name,[str(rustup),'which','--toolchain','stable',name],timeout=10)
            tool=Path(value.strip());need(tool.is_absolute() and tool.is_file() and tool.name==name)
            need(tool.resolve().is_relative_to((Path.home()/'.rustup/toolchains').resolve()))
            paths[name]=tool.resolve()
        for path in paths.values():add_frozen(frozen_files,path)
        env=clean_environment(root,paths['rustc'],paths['rustdoc'])
        revision,_=run('source-head',[str(tools['git']),'rev-parse','HEAD'],timeout=10)
        need(revision.strip()==head,'wrong_checkout')
        rust_version,_=run('rust-version',[str(paths['rustc']),'--version','--verbose'],timeout=10)
        validate_rust_version(rust_version)
        cargo_version,_=run('cargo-version',[str(paths['cargo']),'--version'],timeout=10)
        match=re.fullmatch(r'cargo ([0-9]+\.[0-9]+\.[0-9]+) \(([a-f0-9]+) ([0-9-]+)\)\n',cargo_version)
        need(match is not None,'cargo_version_invalid')
        commits=re.findall(r'^commit-hash: ([a-f0-9]{40})$',rust_version,re.M);need(len(commits)==1,'rust_commit_invalid')
        version={'rustcRelease':re.findall(r'^release: ([0-9.]+)$',rust_version,re.M)[0],'rustcCommit':commits[0],'cargoRelease':match[1],'cargoCommit':match[2],'target':TARGET}
        sysroot_text,_=run('rust-sysroot',[str(paths['rustc']),'--print','sysroot'],timeout=10)
        sysroot=Path(sysroot_text.strip());need(sysroot.is_absolute() and sysroot.resolve().is_relative_to((Path.home()/'.rustup/toolchains').resolve()),'sysroot_invalid')
        stdlib={}
        for name,pattern in [('std','libstd-*.rlib'),('core','libcore-*.rlib')]:
            found=list((sysroot/'lib/rustlib'/TARGET/'lib').glob(pattern));need(len(found)==1,'stdlib_missing');add_frozen(frozen_files,found[0]);stdlib[name]=frozen_files[found[0]]
        saved=json.loads((repo/'docs/recovery/2026-11-13/real-governance-qualification/design/linux-compiler-validation/CARGO-ERROR-OBSERVED-RESULT.json').read_text())
        need(saved.get('head')==OBSERVED_INPUT_HEAD and saved.get('diagnosticCompleted') is True,'observed_receipt_invalid')
        observed_tools={name:frozen_files[path] for name,path in {**{n:tools[n] for n in ['cc','git','true']},**{n:paths[n] for n in ['rustc','cargo']}}.items()}
        verify_observed_inputs(saved,observed_tools,stdlib,version)
        result['toolchain']=version;result['standardLibrarySha256']=stdlib
        run('c-version',[str(tools['cc']),'--version'],timeout=10)
        def fixtures_stage():
            # Trusted launcher/fixture compilation and actual restriction preflight
            # are the ONLY produced executables run, before any registry request.
            native=root/'native'
            for name in ['network_launcher.c','compiler_profile.h','benign_fixture.c','build_ipc_fixture.c','build_ipc_fixture.rs']:
                original=repo/'scripts/linux-compile'/name
                need(original.is_file() and not original.is_symlink(),'trusted_source_missing')
                data=original.read_bytes();copy=native/name
                with copy.open('xb') as out:out.write(data)
                copy.chmod(0o600);add_frozen(frozen_files,copy,hashlib.sha256(data).hexdigest())
            for label,sourcefile,output in [('launcher','network_launcher.c',launcher),('fixture','benign_fixture.c',native/'benign_fixture'),('ipc-c','build_ipc_fixture.c',native/'build_ipc_fixture_c')]:
                dependency=native/(label+'.d')
                run(label+'-headers',[str(tools['cc']),'-std=c11','-I',str(native),'-M','-MF',str(dependency),str(native/sourcefile)],timeout=30)
                for path,digest in header_dependencies(dependency.read_text()).items():add_frozen(frozen_files,path,digest)
                run(label+'-compile',[str(tools['cc']),'-std=c11','-Wall','-Wextra','-Werror','-I',str(native),str(native/sourcefile),'-o',str(output)],timeout=30)
                need(output.is_file() and not output.is_symlink(),'trusted_output_missing')
                add_frozen(frozen_files,output)
            description,_=run('filter-description',[str(launcher),'--describe'],timeout=10)
            result['filter']=validate_filter_description(description,(native/'compiler_profile.h').read_text())
            result['headerAndTrustedInputs']={str(path):digest for path,digest in sorted(frozen_files.items(),key=lambda item:str(item[0]))}
            fixture,_=run('isolation-preflight',[str(native/'benign_fixture'),str(native/'fixture-owned-file'),str(tools['true'])],isolated=True,timeout=15)
            validate_fixture_result(fixture)
            result['tools']={name:{'path':str(path),'sha256':hashlib.sha256(path.resolve().read_bytes()).hexdigest()} for name,path in {**tools,**paths}.items()}
            result['runnerImage']={k:os.environ.get(k) for k in ['ImageOS','ImageVersion','RUNNER_OS','RUNNER_ARCH']}
            ipc,_=run('ipc-c-once',[str(native/'build_ipc_fixture_c')],isolated=True,timeout=5)
            need(ipc=='build-ipc-c:ok\n','ipc_c_fixture_failed')
            run('ipc-rust-compile',[str(paths['rustc']),'--edition=2024','--target',TARGET,str(native/'build_ipc_fixture.rs'),'-o',str(native/'build_ipc_fixture_rust')],timeout=30)
            add_frozen(frozen_files,native/'build_ipc_fixture_rust')
            missing=native/'build-ipc-missing-executable';need(not missing.exists() and not missing.is_symlink(),'missing_target_exists')
            ipc,_=run('ipc-rust-once',[str(native/'build_ipc_fixture_rust'),'/usr/bin/true',str(missing)],isolated=True,timeout=5)
            need(ipc=='build-ipc-rust:ok\n','ipc_rust_fixture_failed')
            return True
        def tiny_stage():
            nonlocal env
            crate=root/'tiny-crate';frozen_files.update(prepare_crate(crate));assert_no_cargo_config(crate,root/'cargo-home')
            old_env=env;env={**env,'CARGO_NET_OFFLINE':'true','CARGO_TARGET_DIR':str(root/'tiny-target')}
            try:
                run('tiny-cargo-once',[str(paths['cargo']),'rustc','--offline','--locked','--target',TARGET,'--lib','--no-default-features'],isolated=True,timeout=15,cwd=crate)
            finally:env=old_env
            assert_no_cargo_config(crate,root/'cargo-home');verify_frozen_files(frozen_files)
            outputs=list((root/'tiny-target'/TARGET/'debug/deps').glob('libaxiom_spawn_probe-*.rlib'))
            need(len(outputs)==1 and outputs[0].is_file() and not outputs[0].is_symlink(),'tiny_output_missing')
            result['tinyOutputSha256']=hashlib.sha256(outputs[0].read_bytes()).hexdigest()
            return True
        def full_stage():
            nonlocal phase
            phase='input-materialization'
            inputs=materialize(repo,root/'source')
            source=Path(inputs['sourceRoot'])
            for path in [inputs['nativeC'],inputs['nativeHeader']]:add_frozen(frozen_files,path)
            result['inputsReceiptSha256']=inputs['receiptSha256']
            (root/'input-receipt.json').write_bytes(inputs['receipt'])
            need(not list(source.rglob('.cargo/config*')), 'upstream_cargo_config')
            for parent in [source,*source.parents]:
                need(not (parent/'.cargo/config').exists() and not (parent/'.cargo/config.toml').exists(),'ancestor_cargo_config')
            verify_source(source,inputs['manifest'])
            lock=inputs['lockBytes']
            run('locked-fetch',[str(paths['cargo']),'fetch','--locked','--target',TARGET],timeout=600,cwd=source)
            need((source/'Cargo.lock').read_bytes()==lock,'lock_changed')
            metadata,_=run('locked-metadata',[str(paths['cargo']),'metadata','--locked','--offline','--format-version','1','--filter-platform',TARGET,'--no-default-features','--features','clock-bound/daemon'],isolated=True,timeout=120,cwd=source)
            resolved=json.loads(metadata)
            result['packages']=[{'id':p['id'],'source':p.get('source'),'license':p.get('license'),'targets':[{'kind':t['kind'],'name':t['name']} for t in p['targets']]} for p in resolved['packages']]
            feature_tree,_=run('feature-tree',[str(paths['cargo']),'tree','--locked','--offline','--target',TARGET,'--package','clock-bound','--no-default-features','--features','daemon','--edges','normal,build','--prefix','none','--format','{p} {f}'],isolated=True,timeout=60,cwd=source)
            verify_feature_tree(feature_tree)
            verify_packet(repo,frozen_packet);verify_source(source,inputs['manifest'])
            native=root/'native'
            run('c-object',[str(tools['cc']),'-std=c11','-O0','-Wall','-Wextra','-c',str(inputs['nativeC']),'-o',str(native/'time_publication.o')],isolated=True,timeout=30)
            add_frozen(frozen_files,native/'time_publication.o')
            out,err=run('rust-staticlib',core_command(paths['cargo']),isolated=True,timeout=1500,cwd=source)
            libraries=native_libraries(out+'\n'+err)
            verify_packet(repo,frozen_packet);verify_source(source,inputs['manifest'])
            need((source/'Cargo.lock').read_bytes()==lock,'lock_changed')
            static=root/'target'/TARGET/'debug/libclock_bound.a'
            need(static.is_file() and not static.is_symlink(),'staticlib_missing')
            add_frozen(frozen_files,static)
            harness=native/'link_only.c'
            with harness.open('x') as out:out.write('int main(void) { return 0; }\n')
            add_frozen(frozen_files,harness)
            executable=native/'link_only'
            run('whole-library-link',link_command(tools['cc'],native,static,libraries),isolated=True,timeout=120)
            need(executable.is_file() and not executable.is_symlink(),'linked_output_missing')
            add_frozen(frozen_files,executable)
            result['outputs']={str(p.relative_to(root)):{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [static,native/'time_publication.o',executable]}
            elf,_=run('elf-header',[str(tools['readelf']),'-h',str(executable)],isolated=True,timeout=10)
            need('ELF64' in elf and 'Advanced Micro Devices X86-64' in elf,'wrong_link_target')
            need(len(elf.encode())<=16384,'elf_header_limit');result['elfHeader']=elf
            raw_symbols,_=run('raw-linked-symbols',[str(tools['nm']),'--defined-only',str(executable)],isolated=True,timeout=30)
            result['rawSymbolEvidence']=collect_symbol_evidence(raw_symbols)
            symbols,_=run('linked-symbols',[str(tools['nm']),'--demangle','--defined-only',str(executable)],isolated=True,timeout=30)
            result['demangledSymbolEvidence']=collect_symbol_evidence(symbols)
            verify_packet(repo,frozen_packet);verify_source(source,inputs['manifest'])
            need((source/'Cargo.lock').read_bytes()==lock,'lock_changed');verify_frozen_files(frozen_files)
            result['finalSourceChecksPassed']=True
            need(result['rawSymbolEvidence']['complete'] and result['demangledSymbolEvidence']['complete'],'symbol_evidence_incomplete')
            verify_symbols(symbols,raw_symbols) # Exact reviewed primary pairs; no substring/closure acceptance.
            return True
        result['accepted']=gated_pipeline(fixtures_stage,tiny_stage,full_stage)
    except BaseException as error:
        result['failurePhase']=phase
        result['errorCategory']=str(error) if isinstance(error,ValueError) and re.fullmatch(r'[a-z_:]+',str(error)) else type(error).__name__
        result['accepted']=False
    finally:
        signal.signal(signal.SIGTERM,previous_term)
        try:
            verify_packet(repo,frozen_packet);verify_frozen_files(frozen_files)
            result['finalFrozenInputsMatched']=True
        except BaseException:
            result['accepted']=False;result.pop('failureDiagnostic',None);result['errorCategory']='final_currentness_unavailable'
            result['finalFrozenInputsMatched']=False;result['finalSourceChecksPassed']=False
        # This bounded primary receipt is emitted even if the bulk package/header
        # record is too large. Never lose the actual names behind a size marker.
        evidence=render_symbol_receipt(result)
        if result['accepted'] and not json.loads(evidence)['evidenceComplete']:
            result['accepted']=False;result['errorCategory']='symbol_evidence_not_retained';evidence=render_symbol_receipt(result)
        print(evidence,flush=True)
        # Plain build receipt only: never qualifications, credentials or runtime authority.
        receipt=json.dumps(result,sort_keys=True,indent=2)+'\n'
        (root/'RESULT.json').write_text(receipt)
        # Explicit argv/tool/header/source/program facts contain no credentials;
        # retain them in bounded job logs because no artifact is uploaded.
        if len(receipt.encode())<=2*1024*1024:print(receipt,end='',flush=True)
        else:print('compiler_receipt_log_limit',flush=True)
        print(json.dumps({'accepted':result['accepted'],'head':head,'phase':phase,'runtimeLaunched':False,'governanceEnabled':False}),flush=True)
    need(result['accepted'],'batch_not_accepted')

if __name__ == '__main__':
    try:main()
    except BaseException:
        print('{"accepted":false,"terminalCategory":"stopped"}',flush=True);sys.exit(1)
