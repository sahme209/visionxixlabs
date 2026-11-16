# Read-only metadata collector for a future owned, fresh managed Windows QA VM.
# Does not launch shortcuts, modify registration or remove any file.
param(
 [Parameter(Mandatory=$true)][string]$OwnedRoot,
 [Parameter(Mandatory=$true)][string]$InstallDirectory,
 [string]$SecondInstallDirectory='',
 [string]$OldProductCode='',
 [string]$NewProductCode=''
)
$ErrorActionPreference = 'Stop'
$InstallDirectories=@($InstallDirectory);if($SecondInstallDirectory){$InstallDirectories+= $SecondInstallDirectory}
$MsiProductCodes=@();if($OldProductCode){$MsiProductCodes+=$OldProductCode};if($NewProductCode){$MsiProductCodes+=$NewProductCode}
if ($InstallDirectories.Count -gt 2 -or $MsiProductCodes.Count -gt 2) { throw 'Fixed upgrade inventory bounds exceeded' }
$root = [IO.Path]::GetFullPath($OwnedRoot).TrimEnd('\')
$runner = [IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd('\')
if (-not $root.StartsWith("$runner\axiom-installed-", [StringComparison]::OrdinalIgnoreCase)) { throw 'Owned upgrade root required' }
$products = @(); $protocols = @(); $shortcuts = @(); $payloads = @()
foreach ($code in $MsiProductCodes) { if ($code -notmatch '^\{[0-9a-fA-F-]{36}\}$') { throw 'Exact MSI product GUID required' } }
foreach ($hive in @([Microsoft.Win32.RegistryHive]::CurrentUser, [Microsoft.Win32.RegistryHive]::LocalMachine)) {
 foreach ($view in @([Microsoft.Win32.RegistryView]::Registry64, [Microsoft.Win32.RegistryView]::Registry32)) {
  $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive,$view)
  try {
   foreach ($name in @('Axiom Agent','V19') + $MsiProductCodes) {
    $key = $base.OpenSubKey("Software\Microsoft\Windows\CurrentVersion\Uninstall\$name",$false)
    if ($null -ne $key) {
     try { $products += [pscustomobject]@{displayName=[string]$key.GetValue('DisplayName');version=[string]$key.GetValue('DisplayVersion');registration=$name;publisher=[string]$key.GetValue('Publisher')} } finally { $key.Dispose() }
    }
   }
   $key=$base.OpenSubKey('Software\Classes\axiom-agent\shell\open\command',$false)
   if ($null -ne $key) { try { $protocols += [string]$key.GetValue('') } finally { $key.Dispose() } }
  } finally { $base.Dispose() }
 }
}
$shell=New-Object -ComObject WScript.Shell
$folders=@([Environment]::GetFolderPath('DesktopDirectory'),[Environment]::GetFolderPath('CommonDesktopDirectory'),[Environment]::GetFolderPath('Programs'),[Environment]::GetFolderPath('CommonPrograms')) | Select-Object -Unique
foreach ($folder in $folders) {
 if (-not $folder) { continue }
 foreach ($subfolder in @('','Axiom Agent','V19')) {
  foreach ($name in @('Axiom Agent.lnk','V19.lnk')) {
   $path=Join-Path (Join-Path $folder $subfolder) $name
   if (Test-Path -LiteralPath $path -PathType Leaf) {
    $item=Get-Item -LiteralPath $path
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Unexpected shortcut reparse point' }
    $link=$shell.CreateShortcut($path) # Read existing .lnk; never call Save/Run.
    $shortcuts += [pscustomobject]@{path=$path;target=$link.TargetPath;arguments=$link.Arguments}
   }
  }
 }
}
foreach ($directory in $InstallDirectories) {
 $full=[IO.Path]::GetFullPath($directory).TrimEnd('\')
 if (-not $full.StartsWith("$root\",[StringComparison]::OrdinalIgnoreCase)) { throw 'Upgrade install directory escaped owner' }
 if (Test-Path -LiteralPath $full) { if ((Get-Item -LiteralPath $full).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Unexpected install reparse point' } }
 $path=Join-Path $full 'axiom-desktop.exe'
 if (Test-Path -LiteralPath $path -PathType Leaf) {
  $item=Get-Item -LiteralPath $path
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Unexpected executable reparse point' }
  $file=[IO.File]::OpenRead($path);$reader=[IO.BinaryReader]::new($file)
  try {
   if ($reader.ReadUInt16() -ne 0x5a4d) { throw 'Invalid PE header' }
   $file.Position=0x3c;$offset=$reader.ReadInt32();if ($offset -lt 64 -or $offset -gt 1048576) { throw 'Invalid PE offset' }
   $file.Position=$offset;if ($reader.ReadUInt32() -ne 0x4550) { throw 'Invalid PE signature' }
   if ($reader.ReadUInt16() -ne 0x8664) { throw 'Unsupported PE architecture' }
  } finally { $reader.Dispose();$file.Dispose() }
  $payloads += [pscustomobject]@{path=$path;sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant();machine='AMD64';version=$item.VersionInfo.ProductVersion}
 }
}
if ($shortcuts.Count -gt 48 -or $products.Count -gt 16 -or $protocols.Count -gt 4) { throw 'Upgrade inventory cap exceeded' }
# Controller parses command strings with its existing CommandLineToArgvW guard.
@{products=@($products | Sort-Object registration,displayName,version,publisher -Unique);shortcuts=@($shortcuts | Sort-Object path -Unique);protocolCommandStrings=@($protocols | Select-Object -Unique);ownedPayloads=@($payloads | Sort-Object path -Unique)} | ConvertTo-Json -Depth 5 -Compress
