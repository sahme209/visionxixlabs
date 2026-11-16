param([Parameter(Mandatory=$true)][string]$ExpectedInstall,[ValidatePattern('^\{[0-9A-Fa-f-]{36}\}$')][string]$ExpectedProductCode='{EA2907BA-437C-4D29-AD47-4A5ABFBB4CFD}',[ValidateSet('Legacy','Current')][string]$ShortcutKind='Legacy')
$ErrorActionPreference='Stop'
$i=New-Object -ComObject WindowsInstaller.Installer
$upgrade='{A3C7DA37-1792-51F2-8B3A-8848B1B33F88}'
$old=$ExpectedProductCode
$component='{EB234B33-5646-54DC-BC0A-9794A161CA82}'
try {
 $related=@();foreach($product in $i.RelatedProducts($upgrade)){if($related.Count -ge 8){throw 'related_product_bound'};$related += [string]$product}
 $properties=[ordered]@{}
 foreach($name in @('InstalledProductName','ProductName','VersionString','Publisher','InstallLocation')){
  try{$properties[$name]=[string]$i.ProductInfo($old,$name)}catch{$properties[$name]='UNAVAILABLE'}
 }
 $componentPath=[string]$i.ComponentPath($old,$component)
 $root=[IO.Path]::GetFullPath($ExpectedInstall)
 $name=if($ShortcutKind -eq 'Legacy'){'Uninstall Axiom Agent.lnk'}else{'Uninstall V19.lnk'}
 $shortcut=Join-Path $root $name
 if(-not (Test-Path -LiteralPath $shortcut -PathType Leaf)){throw 'actual_legacy_root_shortcut_missing'}
 $shell=New-Object -ComObject WScript.Shell
 $link=$shell.CreateShortcut($shortcut)
 $expectedTarget=Join-Path $env:SYSTEMROOT 'System32\msiexec.exe'
 [ordered]@{relatedProductCodes=$related;oldProductInfo=$properties;componentMatchesOwnedPayload=([IO.Path]::GetFullPath($componentPath) -ieq (Join-Path $root 'axiom-desktop.exe'));legacyRootShortcutPresent=$true;legacyRootTargetSystem64=([IO.Path]::GetFullPath($link.TargetPath) -ieq $expectedTarget);legacyRootArgsExact=($link.Arguments -ceq "/x $old");legacyRootBytes=(Get-Item -LiteralPath $shortcut).Length}|ConvertTo-Json -Depth 6 -Compress
} finally {[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($i)}
