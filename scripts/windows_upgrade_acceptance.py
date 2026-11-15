"""Reviewed pure upgrade contracts. No main, downloader or native calls.

Plans are integrated with the reviewed owned Windows process controller. An upgrade audit never repairs or
removes a shortcut. Unexpected state fails qualification.
"""
from pathlib import Path
import ntpath

UPGRADE_RECIPE_REVIEWED = True
LEGACY_VERSION = '0.1.21'
LEGACY_UPGRADE_CODE = 'a3c7da37-1792-51f2-8b3a-8848b1b33f88'
LEGACY_ASSETS = {
 'msi': {'id':689968206,'name':'Axiom.Agent_0.1.21_x64_en-US.msi','bytes':5869568,'sha256':'670a2b926e7e3f9f0d3a2893b4997867101f1710699b4bc3734e2baac4bd98e1'},
 'nsis': {'id':689968076,'name':'Axiom.Agent_0.1.21_x64-setup.exe','bytes':4023071,'sha256':'0d80407c333229d54c9cd3d0f205b99e1944f0622f4da556b02a299eaad893f3'},
}
# GUI maintenance selection is not impersonated by a fictional command switch.
AUTOMATED_CASES = ('msi-major-upgrade','nsis-silent-upgrade','nsis-update')
MANUAL_CASES = ('nsis-maintenance-do-not-uninstall',)


def need(condition, code):
 if not condition: raise RuntimeError(code)


def admitted_legacy_metadata(kind, metadata):
 """After exact public-asset byte hash, real read-only host metadata is required."""
 expected = LEGACY_ASSETS[kind]
 need(metadata.get('sha256') == expected['sha256'] and metadata.get('bytes') == expected['bytes'], 'legacy_asset_bytes_mismatch')
 need(metadata.get('version') == LEGACY_VERSION and metadata.get('productName') == 'Axiom Agent' and metadata.get('machine') == ('AMD64' if kind == 'msi' else 'I386') and metadata.get('artifactKind') == ('MsiInstaller' if kind == 'msi' else 'NsisInstaller'), 'legacy_artifact_identity_mismatch')
 if kind == 'msi':
  need(str(metadata.get('upgradeCode','')).strip('{}').lower() == LEGACY_UPGRADE_CODE, 'actual_legacy_msi_upgrade_code_mismatch')
 return expected


def upgrade_commands(case, tools, base, old_installer, new_installer):
 """Pure fixed argv proposal. It confers no execution/enrollment permission."""
 need(case in AUTOMATED_CASES, 'unsupported_upgrade_case')
 install = str(Path(base) / case)
 need(' ' not in install, 'nsis_fixed_argument_path_requires_no_spaces')
 if case == 'msi-major-upgrade':
  return {'installDirectory':install,'oldInstall':[tools['msiexec.exe'],'/i',str(old_installer),'/qn','/norestart','INSTALLDIR='+install],
          'candidateUpgrade':[tools['msiexec.exe'],'/i',str(new_installer),'/qn','/norestart','INSTALLDIR='+install]}
 return {'installDirectory':install,'oldInstall':[str(old_installer),'/S','/D='+install],
         'candidateUpgrade':[str(new_installer),'/S',*(['/UPDATE'] if case == 'nsis-update' else []),'/D='+install]}


def normalized_snapshot(raw, parse_command):
 need(set(raw) == {'products','shortcuts','protocolCommandStrings','ownedPayloads'}, 'snapshot_shape_invalid')
 for key,cap in [('products',16),('shortcuts',48),('protocolCommandStrings',4),('ownedPayloads',2)]:
  need(isinstance(raw[key],list) and len(raw[key]) <= cap, 'snapshot_bound_exceeded')
 commands=[]
 for value in raw['protocolCommandStrings']:
  need(isinstance(value,str) and len(value) <= 4096, 'protocol_snapshot_invalid')
  commands.append(parse_command(value))
 return {'products':raw['products'],'shortcuts':raw['shortcuts'],'protocolCommands':commands,'ownedPayloads':raw['ownedPayloads']}


def absent_before_owned_cycle(snapshot):
 need(not snapshot['products'] and not snapshot['shortcuts'] and not snapshot['protocolCommands'] and not snapshot['ownedPayloads'], 'preexisting_upgrade_state_refused')
 return True


def upgrade_audit(snapshot, *, executable, sha256, version):
 """Read-only acceptance, never cleanup authority. Fails known stale branding."""
 expected = ntpath.normcase(ntpath.normpath(str(executable)))
 rows = snapshot['products']
 need(len(rows) == 1 and rows[0]['displayName'] == 'V19' and rows[0]['version'] == version and rows[0]['publisher'] == 'visionxixlabs', 'parallel_or_stale_product_registration')
 payloads = snapshot['ownedPayloads']
 need(len(payloads) == 1 and ntpath.normcase(ntpath.normpath(payloads[0]['path'])) == expected and payloads[0]['sha256'] == sha256 and payloads[0]['machine'] == 'AMD64' and payloads[0]['version'] in (version,version+'.0'), 'upgraded_payload_identity_mismatch')
 need(snapshot['protocolCommands'] and all(len(row) == 2 and row[1] == '%1' and ntpath.normcase(ntpath.normpath(row[0])) == expected for row in snapshot['protocolCommands']), 'upgraded_protocol_identity_mismatch')
 shortcuts = snapshot['shortcuts']
 need(shortcuts, 'upgraded_shortcut_missing')
 for row in shortcuts:
  need(ntpath.basename(row['path']) == 'V19.lnk', 'legacy_shortcut_remains')
  need(ntpath.normcase(ntpath.normpath(row['target'])) == expected and not row.get('arguments'), 'shortcut_target_mismatch')
 return {'upgradeObserved':True,'legacyShortcutsAbsent':True,'parallelProductsAbsent':True,'candidatePayloadMatched':True,'authenticatedAcceptance':False,'webviewRenderingVerified':False}


def absent_after_cleanup(snapshot):
 need(not snapshot['products'] and not snapshot['shortcuts'] and not snapshot['protocolCommands'] and not snapshot['ownedPayloads'], 'upgrade_cleanup_incomplete')
 return True
