"""Tiny diagnostic MSI source only. Never compiles/installs/executes anything."""
import argparse,hashlib,json,re
from pathlib import Path
from xml.sax.saxutils import escape,quoteattr
TEMPLATE_SHA='bdca7d5a2bb5a481c85fef58410c2aa00a1b6a2865bbbcd53b920abd471dc1e8'
UPGRADE='{A3C7DA37-1792-51F2-8B3A-8848B1B33F88}'
COMPONENT='{EB234B33-5646-54DC-BC0A-9794A161CA82}'
ACTIONS=('V19ShortcutPreflight','V19RollbackLegacyShortcuts','V19MigrateLegacyShortcuts','V19CommitLegacyShortcuts')
SETTERS=('V19SetRollbackData','V19SetMigrateData','V19SetCommitData')

def extract(template):
 if hashlib.sha256(template.encode()).hexdigest()!=TEMPLATE_SHA:raise ValueError('frozen_template_changed')
 blocks=[]
 for name in ACTIONS:
  matches=re.findall(r'<CustomAction Id="'+name+r'"[^>]*><!\[CDATA\[[\s\S]*?\]\]></CustomAction>',template)
  if len(matches)!=1:raise ValueError('exact_action_missing')
  blocks.append(matches[0])
 for name in SETTERS:
  matches=re.findall(r'<CustomAction Id="'+name+r'"[^>]*/>',template)
  if len(matches)!=1:raise ValueError('exact_setter_missing')
  blocks.append(matches[0])
 schedules=[b for b in re.findall(r'<InstallExecuteSequence>[\s\S]*?</InstallExecuteSequence>',template) if 'V19SetRollbackData' in b]
 if len(schedules)!=1:raise ValueError('exact_schedule_missing')
 return blocks,schedules[0]

def generate(template,application_source,install_directory,mode,product_code):
 if mode not in ('commit','rollback'):raise ValueError('fixture_mode_refused')
 if not re.fullmatch(r'\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}',product_code):raise ValueError('fixture_product_code_refused')
 if not all(isinstance(p,str) and p and len(p)<32768 and not any(ord(c)<32 for c in p) for p in (application_source,install_directory)):raise ValueError('fixture_path_refused')
 blocks,schedule=extract(template)
 failure=''
 if mode=='rollback':
  failure='''
<CustomAction Id="V19FixtureSetFailureData" Property="V19FixtureFailAfterMigrate" Value="[INSTALLDIR]axiom-desktop.exe" />
<CustomAction Id="V19FixtureFailAfterMigrate" Script="vbscript" Win64="yes" Execute="deferred" Impersonate="no" Return="check"><![CDATA[
Option Explicit
Dim fixtureFso, fixtureExpected, fixtureSuffix
Set fixtureFso = CreateObject("Scripting.FileSystemObject")
fixtureExpected = Session.Property("CustomActionData")
For Each fixtureSuffix In Array(".v19-legacy-desktop.lnk", ".v19-legacy-menu.lnk", ".v19-legacy-uninstall.lnk")
  If Not fixtureFso.FileExists(fixtureExpected & fixtureSuffix) Then Err.Raise vbObjectError + 514, "V19 owned fixture", "Fixture three-backup proof missing"
Next
Err.Raise vbObjectError + 515, "V19 owned fixture", "Fixture all three backups verified; rollback requested"
]]></CustomAction>
<InstallExecuteSequence>
  <Custom Action="V19FixtureSetFailureData" After="V19ShortcutPreflight">1</Custom>
  <Custom Action="V19FixtureFailAfterMigrate" After="V19CommitLegacyShortcuts">NOT REMOVE</Custom>
</InstallExecuteSequence>
'''
 # The original commit action is registered after migrate, but only executes at
 # InstallFinalize. The injected deferred failure runs after its registration
 # and before commit execution, preserving the exact product action schedule.
 return '''<?xml version="1.0" encoding="utf-8"?>
<?define Win64 = "yes" ?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
<Product Id='''+quoteattr(product_code)+''' Name="V19" Language="1033" Version="0.1.23" Manufacturer="visionxixlabs" UpgradeCode="'''+UPGRADE+'''">
<Package InstallerVersion="450" Compressed="yes" InstallScope="perMachine" />
<MediaTemplate EmbedCab="yes" />
<Property Id="REINSTALLMODE" Value="amus" />
<MajorUpgrade Schedule="afterInstallInitialize" AllowSameVersionUpgrades="yes" DowngradeErrorMessage="Diagnostic fixture refuses downgrade" />
<InstallExecuteSequence><RemoveShortcuts>Installed</RemoveShortcuts></InstallExecuteSequence>
<Property Id="INSTALLDIR" Value='''+quoteattr(install_directory)+''' />
'''+ '\n'.join(blocks)+'\n'+schedule+'\n'+failure+'''
<Directory Id="TARGETDIR" Name="SourceDir">
 <Directory Id="ProgramFiles64Folder"><Directory Id="INSTALLDIR" Name="V19" /></Directory>
 <Directory Id="DesktopFolder" Name="Desktop" />
 <Directory Id="ProgramMenuFolder"><Directory Id="ApplicationProgramsFolder" Name="V19" /></Directory>
</Directory>
<DirectoryRef Id="INSTALLDIR">
 <Component Id="Path" Guid="'''+COMPONENT+'''" Win64="yes"><File Id="Path" Name="axiom-desktop.exe" Source='''+quoteattr(application_source)+''' KeyPath="yes" Checksum="yes" /></Component>
 <Component Id="RegistryEntries" Guid="*" Win64="yes"><RegistryKey Root="HKCU" Key="Software\\visionxixlabs\\V19"><RegistryValue Name="InstallDir" Type="string" Value="[INSTALLDIR]" KeyPath="yes" /></RegistryKey></Component>
 <Component Id="CMP_UninstallShortcut" Guid="*" Win64="yes">
  <Shortcut Id="UninstallShortcut" Name="Uninstall V19" Target="[System64Folder]msiexec.exe" Arguments="/x [ProductCode]" />
  <RemoveFolder Id="RemoveOwnedInstallDirectory" Directory="INSTALLDIR" On="uninstall" />
  <RegistryValue Root="HKCU" Key="Software\\visionxixlabs\\V19" Name="Uninstaller Shortcut" Type="integer" Value="1" KeyPath="yes" />
 </Component>
</DirectoryRef>
<DirectoryRef Id="DesktopFolder"><Component Id="ApplicationShortcutDesktop" Guid="*" Win64="yes">
 <Shortcut Id="ApplicationDesktopShortcut" Name="V19" Target="[!Path]" WorkingDirectory="INSTALLDIR" />
 <RegistryValue Root="HKCU" Key="Software\\visionxixlabs\\V19" Name="Desktop Shortcut" Type="integer" Value="1" KeyPath="yes" />
</Component></DirectoryRef>
<DirectoryRef Id="ApplicationProgramsFolder"><Component Id="ApplicationShortcut" Guid="*" Win64="yes">
 <Shortcut Id="ApplicationStartMenuShortcut" Name="V19" Target="[!Path]" WorkingDirectory="INSTALLDIR" />
 <RemoveFolder Id="ApplicationProgramsFolder" On="uninstall" />
 <RegistryValue Root="HKCU" Key="Software\\visionxixlabs\\V19" Name="Start Menu Shortcut" Type="integer" Value="1" KeyPath="yes" />
</Component></DirectoryRef>
<Feature Id="MainProgram" Level="1" Absent="disallow"><ComponentRef Id="Path" /><ComponentRef Id="RegistryEntries" /><ComponentRef Id="CMP_UninstallShortcut" /><ComponentRef Id="ApplicationShortcutDesktop" /><ComponentRef Id="ApplicationShortcut" /></Feature>
<SetProperty Id="ARPINSTALLLOCATION" Value="[INSTALLDIR]" After="CostFinalize" />
</Product></Wix>
'''

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--template',required=True);parser.add_argument('--application-source',required=True);parser.add_argument('--install-directory',required=True);parser.add_argument('--mode',choices=['commit','rollback'],required=True);parser.add_argument('--product-code',required=True);parser.add_argument('--output',required=True);args=parser.parse_args();text=generate(Path(args.template).read_text(),args.application_source,args.install_directory,args.mode,args.product_code);Path(args.output).write_text(text);print(json.dumps({'fixtureOnly':True,'releaseAcceptance':False,'sourceTemplateSha256':TEMPLATE_SHA,'mode':args.mode,'generatedSha256':hashlib.sha256(text.encode()).hexdigest()}))
if __name__=='__main__':main()
