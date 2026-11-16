"""Fixed same-job unsigned release-byte installed QA. No artifact download/build."""
from pathlib import Path
import hashlib,json,os,re,sys
sys.dont_write_bytecode=True
import windows_installed_acceptance as qa
CYCLES=('msi-major-upgrade','nsis-silent-upgrade','nsis-update','nsis-collision-legacy','nsis-collision-current')

def release_source_binding(env,event,version):
    qa.need(env.get('GITHUB_EVENT_NAME')=='workflow_dispatch' and env.get('GITHUB_RUN_ATTEMPT')==env.get('CANDIDATE_RUN_ATTEMPT')=='1','release_manual_first_attempt_required')
    qa.need(env.get('GITHUB_REPOSITORY')==qa.REPOSITORY and env.get('GITHUB_ACTOR')==qa.EXPECTED_ACTOR,'release_actor_or_repository_changed')
    repo=event.get('repository',{})
    qa.need(repo.get('id')==1130181785 and repo.get('full_name')==qa.REPOSITORY and repo.get('private') is False,'release_public_repository_required')
    qa.need(isinstance(version,str) and re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+',version) and env.get('VERSION')==version,'release_version_changed')
    tag='desktop-v'+version
    qa.need(env.get('RELEASE_TAG')==tag and event.get('inputs',{}).get('release_tag')==tag and env.get('GITHUB_REF')=='refs/tags/'+tag,'release_tag_changed')
    sha=env.get('SOURCE_SHA','');run=env.get('CANDIDATE_RUN_ID','')
    qa.need(re.fullmatch(r'[a-f0-9]{40}',sha) and sha==env.get('GITHUB_SHA') and re.fullmatch(r'[1-9][0-9]*',run) and run==env.get('GITHUB_RUN_ID') and env.get('TARGET')==qa.TARGET,'release_source_run_or_target_changed')
    return {'sha':sha,'sourceSha':sha,'releaseTag':tag,'version':version,'runId':run,'runAttempt':'1','target':qa.TARGET,'sourceAuthority':'ordinary-owner-release-CI','externalHumanApprovalProof':False}

def snapshot_prebuilt(root):
    root=Path(root).resolve(strict=True)
    folder=root/'desktop/src-tauri/target'/qa.TARGET/'release'
    for directory in (root/'desktop',root/'desktop/src-tauri',root/'desktop/src-tauri/target',folder.parent,folder,folder/'bundle',folder/'bundle/msi',folder/'bundle/nsis'):
        qa.need(directory.is_dir() and not directory.is_symlink() and not getattr(directory,'is_junction',lambda:False)() and directory.resolve(strict=True)==directory,'release_artifact_directory_alias_refused')
    payload=qa.owned_file(folder/'axiom-desktop.exe',folder)
    artifacts=qa.installers(folder/'bundle')
    result={'raw':{'sizeBytes':payload.stat().st_size,'sha256':qa.digest(payload)},'assets':{}}
    for kind,file in artifacts.items():
        qa.need(file.stat().st_size>0 and len(file.name)<=200 and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._ -]*',file.name) and file.name.strip()==file.name,'release_installer_name_or_size_refused')
        result['assets'][kind]={'fileName':file.name,'sizeBytes':file.stat().st_size,'sha256':qa.digest(file)}
    qa.need(result['raw']['sizeBytes']>0,'release_payload_empty')
    return result

def same_prebuilt(before,after):
    qa.need(before==after,'prebuilt_release_bytes_changed')

def release_receipt(identity,evidence,snapshot):
    qa.need(evidence.get('source')==identity['sourceSha'] and evidence.get('accepted') is True and evidence.get('sourceUnchanged') is True and evidence.get('keyringCleanupConfirmed') is True and evidence.get('ownedProcessCleanupConfirmed') is True,'release_installed_acceptance_incomplete')
    qa.need(evidence.get('unsignedValidationOnly') is True and evidence.get('signingPerformed') is False and evidence.get('published') is False,'release_unsigned_policy_changed')
    installations=evidence.get('installations',[]);upgrades=evidence.get('upgradeCycles',[]);returncheck=evidence.get('msiShortcutReturncheck',{})
    qa.need(len(installations)==2 and {x.get('kind') for x in installations}=={'msi','nsis'} and all(x.get('installConfirmed') is True and x.get('uninstallConfirmed') is True and x.get('nativeTopLevelWindowObserved') is True and x.get('protocolRegistered') is True and x.get('metadata',{}).get('signatureStatus')=='NotSigned' and x.get('installedPayloadSha256')==x.get('expectedPayloadSha256') and isinstance(x.get('expectedPayloadSha256'),str) and re.fullmatch(r'[a-f0-9]{64}',x['expectedPayloadSha256']) and x.get('installerSha256')==snapshot['assets'][x['kind']]['sha256'] for x in installations),'release_clean_cycles_incomplete')
    qa.need(len(upgrades)==5 and {x.get('case') for x in upgrades}==set(CYCLES) and all(x.get('oldInstallConfirmed') is True and x.get('cleanupConfirmed') is True and x.get('candidateSha256')==snapshot['assets'][x.get('installKind')]['sha256'] and (x.get('expectedCollisionRefused') is True if x['case'].startswith('nsis-collision-') else x.get('upgradeConfirmed') is True and x.get('nativeTopLevelWindowObserved') is True) for x in upgrades) and evidence.get('upgradeAcceptance')=='automated-five-cycles-passed','release_upgrade_cycles_incomplete')
    qa.need(all(returncheck.get(k) is True for k in ['returncheckVerified','foreignLinkPreserved','cleanupConfirmed','fixedActionObserved','fixedOwnershipErrorObserved']),'release_msi_returncheck_incomplete')
    return {'schema':'axiom.windows-release-installed-validation/1',**{key:identity[key] for key in ['sourceSha','releaseTag','version','runId','runAttempt','target']},'accepted':True,'installerBytesUnchanged':True,'rawPayloadUnchanged':True,'msiReturncheckVerified':True,'cleanInstallKinds':['msi','nsis'],'upgradeCases':list(CYCLES),'keyringCleanupConfirmed':True,'ownedProcessCleanupConfirmed':True,'installerCleanupConfirmed':True,'signaturePolicy':'unsigned-only','uiVisualAcceptance':'UNVERIFIED','googlePairing':'NOT_RUN','assets':[{'kind':kind,**snapshot['assets'][kind]} for kind in ['msi','nsis']]}

def main():
    qa.need(len(sys.argv)==1 and os.name=='nt','fixed_windows_release_entry_required')
    event=json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    version=json.loads((qa.ROOT/'desktop/package.json').read_text())['version']
    binding=release_source_binding(os.environ,event,version)
    manifest=qa.ROOT/qa.REVIEWED_MANIFEST
    qa.need(manifest.is_file() and not manifest.is_symlink(),'reviewed_manifest_missing')
    binding['manifestSha256']=qa.digest(manifest)
    enrolled=qa.reviewed_manifest(binding,qa.ROOT)
    qa.need({'scripts/windows_release_acceptance.py','.github/workflows/desktop-release.yml'}<=set(enrolled),'release_source_not_enrolled')
    qa._run_installed_acceptance(binding,_prebuilt_release=binding)

if __name__=='__main__':main()
