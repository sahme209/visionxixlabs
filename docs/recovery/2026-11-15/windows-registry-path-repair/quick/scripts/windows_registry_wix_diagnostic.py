"""Managed installed WiX only: two RegLocator keys, no app/build/install/download."""
import sys
sys.dont_write_bytecode=True
import hashlib,json,os,re,shutil,time,uuid
from pathlib import Path
from xml.sax.saxutils import quoteattr
import windows_installed_acceptance as qa
from windows_msi_byte_diagnostic import authority

def render_known_legacy_key(source):
    # Exact pinned handlebars6.3.0 fragment, NOT a general template renderer.
    # grammar.pest5 +template.rs638 remove one escape before {{ only.
    prefix='Software'+chr(92)*2+'{{manufacturer}}'
    qa.need(source.startswith(prefix),'registry_source_prefix_changed')
    suffix=source[len(prefix):]
    qa.need(suffix in (chr(92)+'Axiom Agent',chr(92)*2+'Axiom Agent'),'registry_literal_suffix_changed')
    return 'Software'+chr(92)+'visionxixlabs'+suffix

def fixture(key):
    key=quoteattr(key)
    return '''<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi"><Product Id="*" Name="Owned Registry Validation Fixture" Language="1033" Version="1.0.0" Manufacturer="Owned fixture" UpgradeCode="9AA142B2-9394-4AC4-AEC0-727364F9041F"><Package InstallerVersion="450" Compressed="yes" InstallScope="perUser"/><Media Id="1" Cabinet="fixture.cab" EmbedCab="yes"/><Property Id="LEGACY_INSTALLDIR"><RegistrySearch Id="V19LegacyInstallDirNoName" Root="HKCU" Key='''+key+''' Type="raw"/><RegistrySearch Id="V19LegacyInstallDirWithName" Root="HKCU" Key='''+key+''' Name="InstallDir" Type="raw"/></Property><Directory Id="TARGETDIR" Name="SourceDir"><Directory Id="LocalAppDataFolder"><Directory Id="INSTALLDIR" Name="OwnedRegistryFixture"><Component Id="OwnedRegistryAnchor" Guid="285F433B-795C-492E-9F2C-D52806DA4F23"><RegistryValue Root="HKCU" Key="Software\\OwnedRegistryFixture" Name="Anchor" Type="integer" Value="1" KeyPath="yes"/><RemoveFolder Id="OwnedFolder" On="uninstall"/></Component></Directory></Directory></Directory><Feature Id="Main" Title="Owned fixture" Level="1"><ComponentRef Id="OwnedRegistryAnchor"/></Feature></Product></Wix>'''

def installed_tools():
    value=os.environ.get('WIX','')
    roots=[Path(value)] if value else []
    if os.environ.get('ProgramFiles(x86)'):roots.append(Path(os.environ['ProgramFiles(x86)'])/'WiX Toolset v3.14')
    pairs=[]
    for root in roots:
        for directory in (root/'bin',root):
            candle=directory/'candle.exe';light=directory/'light.exe'
            if candle.is_file() and light.is_file():
                qa.need(not candle.is_symlink() and not light.is_symlink(),'managed_wix_tool_link')
                pairs.append((candle.resolve(strict=True),light.resolve(strict=True)))
    pairs=list(dict.fromkeys(pairs));qa.need(len(pairs)==1,'managed_wix_unavailable_or_ambiguous_no_acquisition')
    return pairs[0]

def main():
    authority();base=qa.validated_runner_temp(os.environ.get('RUNNER_TEMP'))/('axiom-installed-registry-'+uuid.uuid4().hex);base.mkdir(exist_ok=False);output=base/'evidence';output.mkdir();runner=qa.OwnedWindowsProcess(output,time.monotonic()+120)
    packet=qa.ROOT/'scripts/windows-registry-wix-inputs.json';inputs=json.loads(packet.read_text());result={'accepted':False,'scope':'two RegistrySearch-only MSI link validation','applicationOrRustBuilt':False,'installerExecuted':False,'downloads':False,'processes':runner.records,'packetSha256':qa.digest(packet)};stage='source_guard'
    temp_before={name:os.environ.get(name) for name in ['TEMP','TMP']}
    try:
        qa.need(all(qa.digest(qa.ROOT/name)==value for name,value in inputs.items()),'reviewed_source_changed')
        stage='checkout_guard';git=shutil.which('git.exe');qa.need(bool(git),'managed_git_missing');git=Path(git).resolve(strict=True);qa.need(git.is_file(),'managed_git_missing');qa.need(runner.run('checkout-head',[git,'rev-parse','HEAD'],qa.ROOT,5).strip()==os.environ['GITHUB_SHA'],'checkout_head_mismatch');stage='tool_admission';candle,light=installed_tools();result['tools']={name:{'path':str(tool),'sha256':qa.digest(tool)} for name,tool in [('candle',candle),('light',light)]}
        for name,tool in [('candle',candle),('light',light)]:
            banner=runner.run(name+'-version',[tool,'-?'],base,10)
            qa.need('3.14.1.8722' in banner,'managed_wix_version_unsupported')
        temporary=base/'tool-temp';temporary.mkdir();os.environ['TEMP']=str(temporary);os.environ['TMP']=str(temporary)
        source=json.loads((qa.ROOT/'scripts/registry-render-cases.json').read_text());result['renderedKeys']={name:render_known_legacy_key(value) for name,value in source.items()}
        qa.need(result['renderedKeys']['bad']==r'Software\visionxixlabs\\Axiom Agent' and result['renderedKeys']['good']==r'Software\visionxixlabs\Axiom Agent','known_render_contract_changed')
        for case in ('bad','good'):
            stage=case+'-candle';wxs=base/(case+'.wxs');wxs.write_text(fixture(result['renderedKeys'][case]));obj=base/(case+'.wixobj');msi=base/(case+'.msi')
            runner.run(case+'-candle',[candle,'-nologo','-arch','x64','-out',obj,wxs],base,15)
            stage=case+'-light';runner.run(case+'-light',[light,'-nologo','-out',msi,obj],base,30,allow=(0,1,204) if case=='bad' else (0,))
            row=runner.records[-1];text='\n'.join(row['diagnostics'][stream]['text'] for stream in ('stdout','stderr'))
            if case=='bad':
                qa.need(row['exitCode']!=0 and all(token in text for token in ['LGHT0204','ICE03','Invalid registry path','V19LegacyInstallDirNoName','V19LegacyInstallDirWithName']),'original_bad_key_failure_not_reproduced')
                result['oldInvalidKeysRefused']=True
            else:
                qa.need(msi.is_file() and msi.stat().st_size>0,'corrected_fixture_missing');result['correctedKeysLinked']=True
        result['sourceInputsMatched']=all(qa.digest(qa.ROOT/name)==value for name,value in inputs.items()) and qa.digest(packet)==result['packetSha256'];result['accepted']=result['sourceInputsMatched']
    except Exception:result['failure']={'stage':stage,'code':'fixed_registry_wix_diagnostic_failed'}
    finally:
        for name,value in temp_before.items():
            if value is None:os.environ.pop(name,None)
            else:os.environ[name]=value
        clean=False
        try:
            qa.need(not base.is_symlink() and all(not p.is_symlink() and not getattr(p,'is_junction',lambda:False)() for p in base.rglob('*')),'owned_fixture_link_changed')
            for p in list(base.iterdir()):
                if p!=output:
                    if p.is_dir():shutil.rmtree(p)
                    else:p.unlink()
            clean=all(p==output for p in base.iterdir())
        except Exception:result['cleanupFailure']='owned_registry_fixture_cleanup_unconfirmed'
        result['ownedFixtureRemoved']=clean;result['ownedProcessesEmpty']=all(row['ownedJobEmpty'] for row in runner.records);result['accepted']=result['accepted'] and clean and result['ownedProcessesEmpty'];print('V19_REGISTRY_WIX_RESULT:'+qa.primary_receipt(result),flush=True)
    return 0 if result['accepted'] else 1
if __name__=='__main__':raise SystemExit(main())
