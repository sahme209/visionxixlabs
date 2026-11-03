"""Actual ordinary Foundation/path tests ONLY. Never construct SMAppService or register.
The sole host operation executed is --inspect-reviewed-unit, which returns before SM APIs.
"""
from pathlib import Path
import hashlib,json,os,plistlib,shutil,subprocess,tempfile

SOURCE=Path(__file__).resolve().parent
ROOT=Path('/private/tmp/axiom-origin-unit-prepared-uvmsc9zv')

def command(argv):
    result=subprocess.run(argv,capture_output=True,text=True,timeout=10)
    return {'exit':result.returncode,'stdout':result.stdout[:8192],'stderr':result.stderr[:8192]}

def inspect(path,expected):
    result=command([str(path),'--inspect-reviewed-unit']);data=json.loads(result['stdout'])
    assert result['exit']==expected,result
    assert data['operation']=='--inspect-reviewed-unit'
    if expected==0:assert data['exactCallingBundle'] is True and data['serviceManagementAccessed'] is False
    else:assert data['exactCallingBundle'] is False
    assert 'status' not in data and 'preStatus' not in data and 'postStatus' not in data
    return result

def main():
    app=ROOT/'Axiom Origin Unit.app';host=app/'Contents/MacOS/AxiomOriginRegistrationHost'
    receipts={'scope':'ordinary actual Foundation/filesystem only; no SMAppService construction/status/registration/probe','preparedRoot':str(ROOT),'cases':[]}
    for name,path in [('private-tmp-alias',host),('tmp-alias',Path(str(host).replace('/private/tmp/','/tmp/',1)))]:
        receipts['cases'].append({'case':name,'result':inspect(path,0)})
    fixture=Path(tempfile.mkdtemp(prefix='axiom-origin-foundation-fixture-',dir='/private/tmp'));fixture.chmod(0o700)
    receipts['fixtureRoot']=str(fixture)
    copied=fixture/'Wrong Copy.app';shutil.copytree(app,copied)
    receipts['cases'].append({'case':'wrong-copy-refused','result':inspect(copied/'Contents/MacOS/AxiomOriginRegistrationHost',65)})
    # A separate fixture compiled for its OWN root isolates identifier/main checks.
    own=fixture/'Axiom Origin Unit.app';mac=own/'Contents/MacOS';mac.mkdir(parents=True)
    (fixture/'config.h').write_text('#define UNIT_ROOT '+json.dumps(str(fixture))+'\n')
    fixture_host=mac/'AxiomOriginRegistrationHost'
    build=command(['/usr/bin/xcrun','clang','-std=c11','-Wall','-Wextra','-Werror','-O1','-mmacosx-version-min=13.0','-I'+str(fixture),str(SOURCE/'registration_host.m'),'-framework','Foundation','-framework','ServiceManagement','-o',str(fixture_host)])
    assert build['exit']==0,build
    info={'CFBundleIdentifier':'com.visionxixlabs.axiom.origin-unit.app','CFBundleExecutable':'AxiomOriginRegistrationHost','CFBundlePackageType':'APPL','CFBundleVersion':'1','CFBundleName':'Axiom Origin Unit'}
    def save_and_sign():
        (own/'Contents/Info.plist').write_bytes(plistlib.dumps(info))
        result=command(['/usr/bin/codesign','--force','--sign','-',str(own)]);assert result['exit']==0,result
    save_and_sign();receipts['cases'].append({'case':'owned-fixture-positive','result':inspect(fixture_host,0)})
    info['CFBundleIdentifier']='com.visionxixlabs.axiom.wrong-fixture';save_and_sign()
    receipts['cases'].append({'case':'wrong-identifier-refused','result':inspect(fixture_host,65)})
    info['CFBundleIdentifier']='com.visionxixlabs.axiom.origin-unit.app';info['CFBundleExecutable']='AlternateMain';alternate=mac/'AlternateMain';shutil.copy2(fixture_host,alternate);save_and_sign()
    receipts['cases'].append({'case':'wrong-process-main-refused','result':inspect(alternate,65)})
    receipts['casesPassed']=len(receipts['cases']);receipts['sourceSha256']=hashlib.sha256((SOURCE/'registration_host.m').read_bytes()).hexdigest()
    path=fixture/'inspection-results.json';path.write_text(json.dumps(receipts,indent=2)+'\n');print(json.dumps({'result':'PASS','cases':len(receipts['cases']),'receipt':str(path),'serviceManagementAccessed':False}))

if __name__=='__main__':main()
