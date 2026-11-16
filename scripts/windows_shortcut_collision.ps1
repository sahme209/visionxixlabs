# Fixed synthetic foreign-link fixture; no shortcut execution or app credentials.
param([Parameter(Mandatory=$true)][string]$OwnedRoot,[Parameter(Mandatory=$true)][string]$InstallDirectory,[Parameter(Mandatory=$true)][ValidateSet('legacy','current')][string]$Slot,[ValidateSet('Create','Verify','Cleanup')][string]$Mode='Create',[string]$ExpectedSha256='',[ValidateSet('User','Public')][string]$DesktopKind='User')
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath($OwnedRoot).TrimEnd('\');$runner=[IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd('\');$install=[IO.Path]::GetFullPath($InstallDirectory).TrimEnd('\')
if (-not $root.StartsWith("$runner\axiom-installed-",[StringComparison]::OrdinalIgnoreCase) -or -not $install.StartsWith("$root\",[StringComparison]::OrdinalIgnoreCase)) { throw 'Owned collision root required' }
$filename=if($Slot -eq 'legacy'){'Axiom Agent.lnk'}else{'V19.lnk'}
$desktopFolder=if($DesktopKind -eq 'Public'){'CommonDesktopDirectory'}else{'DesktopDirectory'}
if($DesktopKind -eq 'Public' -and $Slot -ne 'current'){throw 'Public collision permits only current identity'}
$path=Join-Path ([Environment]::GetFolderPath($desktopFolder)) $filename
$target=Join-Path $root 'synthetic-foreign-target.exe';$shell=New-Object -ComObject WScript.Shell
if ($Mode -ne 'Create') {
 if ($ExpectedSha256 -notmatch '^[0-9a-f]{64}$' -or -not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'Owned collision cleanup proof missing' }
 $item=Get-Item -LiteralPath $path;if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Collision shortcut replaced'}
 if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExpectedSha256) { throw 'Collision shortcut changed' }
 $link=$shell.CreateShortcut($path);if($link.TargetPath -ne $target -or $link.Arguments -ne ''){throw 'Collision shortcut target changed'}
 if($Mode -eq 'Cleanup'){Remove-Item -LiteralPath $path}
 @{removed=($Mode -eq 'Cleanup');preserved=$true}|ConvertTo-Json -Compress;exit
}
if(Test-Path -LiteralPath $path){
 if($Slot -ne 'legacy'){throw 'Collision destination already exists'}
 $item=Get-Item -LiteralPath $path;if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Collision source is a reparse point'}
 $link=$shell.CreateShortcut($path)
 if($link.TargetPath -ne (Join-Path $install 'axiom-desktop.exe') -or $link.Arguments -ne ''){throw 'Existing legacy shortcut is not owned'}
}else{
 if($Slot -eq 'legacy'){throw 'Legacy shortcut was not installed'}
 $link=$shell.CreateShortcut($path)
}
$link.TargetPath=$target;$link.Arguments='';$link.Save()
@{path=$path;target=$target;sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}|ConvertTo-Json -Compress
