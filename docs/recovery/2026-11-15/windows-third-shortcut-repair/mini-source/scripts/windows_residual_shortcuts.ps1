param([Parameter(Mandatory=$true)][string]$OwnedRoot,[Parameter(Mandatory=$true)][string]$OldProductCode,[Parameter(Mandatory=$true)][string]$NewProductCode)
$ErrorActionPreference='Stop'
$guid='^\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}$'
if($OldProductCode -notmatch $guid -or $NewProductCode -notmatch $guid){throw 'Residual shortcut scope refused'}
$base=[IO.Path]::GetFullPath($OwnedRoot);$install=Join-Path $base 'application'
foreach($folder in @($base,$install)){$item=Get-Item -LiteralPath $folder -Force;if(-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Residual shortcut directory refused'}}
$ownedExe=Join-Path $install 'axiom-desktop.exe';$msiExe=Join-Path $env:SYSTEMROOT 'System32\msiexec.exe'
$shell=New-Object -ComObject WScript.Shell;$rows=[Collections.Generic.List[object]]::new();$queue=[Collections.Generic.Queue[object]]::new();$queue.Enqueue(@($install,0));$seen=0
while($queue.Count -gt 0 -and $seen -lt 32){$current=$queue.Dequeue();$folder=Get-Item -LiteralPath $current[0] -Force;if($folder.Attributes -band [IO.FileAttributes]::ReparsePoint){continue}
 foreach($path in [IO.Directory]::EnumerateFileSystemEntries($current[0])){if($seen -ge 32){break};$seen++;$item=Get-Item -LiteralPath $path -Force;if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){continue}
  if($item.PSIsContainer){if($current[1] -lt 1){$queue.Enqueue(@($item.FullName,1))};continue}
  if($item.Extension -ne '.lnk' -or $item.Length -gt 65536){continue}
  $relative=$item.FullName.Substring($install.Length+1).Replace('\','/');if($relative.Length -gt 360 -or $relative -match '[^\x20-\x7e]'){$relative='[redacted-relative-name]'}
  try{$link=$shell.CreateShortcut($item.FullName);$owned=[string]::Equals($link.TargetPath,$ownedExe,[StringComparison]::OrdinalIgnoreCase);$systemMsi=[string]::Equals($link.TargetPath,$msiExe,[StringComparison]::OrdinalIgnoreCase);$shortcutArgs=[string]$link.Arguments;$uninstall=$shortcutArgs -match '(?i)^/x\s*(\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\})$';$product='none';if($uninstall){$code=$Matches[1];$product=if($code -ieq $OldProductCode){'legacy'}elseif($code -ieq $NewProductCode){'candidate'}else{'other-guid'}}
   $rows.Add(@{relativeName=$relative;targetIsOwnedApplication=$owned;targetIsSystem32MsiExec=$systemMsi;argumentsEmpty=($shortcutArgs.Length -eq 0);argumentsAreUninstallGuid=$uninstall;uninstallProductClass=$product})
  }catch{$rows.Add(@{relativeName=$relative;metadataUnavailable=$true})}
 }
}
@{schema='axiom.windows-residual-shortcuts/1';maxEntries=32;maxDepth=2;rows=$rows.ToArray()}|ConvertTo-Json -Depth 5 -Compress
