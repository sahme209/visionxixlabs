param(
  [Parameter(Mandatory=$true)][string]$Candidate,
  [Parameter(Mandatory=$true)][string]$ExpectedVersion,
  [Parameter(Mandatory=$true)][ValidateSet('MsiInstaller','NsisInstaller','Application')][string]$ArtifactKind,
  [ValidateSet('Candidate','Legacy')][string]$Role = 'Candidate'
)
$ErrorActionPreference = 'Stop'
$item = Get-Item -LiteralPath $Candidate
if (($ArtifactKind -eq 'MsiInstaller' -and $item.Extension -ne '.msi') -or ($ArtifactKind -ne 'MsiInstaller' -and $item.Extension -ne '.exe')) { throw 'Artifact role and extension mismatch' }
if (-not $item.PSIsContainer -and $item.Extension -in @('.msi', '.exe')) {
  $signature = Get-AuthenticodeSignature -LiteralPath $item.FullName
  if ($Role -eq 'Candidate' -and $signature.Status.ToString() -ne 'NotSigned') { throw 'Expected explicitly unsigned validation candidate' }
  if ($Role -eq 'Legacy' -and ($ExpectedVersion -ne '0.1.21' -or $signature.Status.ToString() -notin @('Valid','NotSigned'))) { throw 'Legacy metadata policy refused' }
  $expectedProduct = if ($Role -eq 'Legacy') { 'Axiom Agent' } else { 'V19' }
  $result = @{ artifactKind=$ArtifactKind; bytes=$item.Length; sha256 = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant(); signatureStatus = $signature.Status.ToString() }
  if ($item.Extension -eq '.msi') {
    $installer = New-Object -ComObject WindowsInstaller.Installer
    $database = $installer.OpenDatabase($item.FullName, 0)
    foreach ($property in @('ProductCode', 'UpgradeCode', 'ProductVersion', 'ProductName')) {
      $view = $database.OpenView("SELECT ``Value`` FROM ``Property`` WHERE ``Property``='$property'")
      $view.Execute(); $record = $view.Fetch()
      if ($null -eq $record) { throw 'Required MSI identity property missing' }
      $result[$property] = $record.StringData(1)
      $view.Close()
    }
    $summary=$database.SummaryInformation(0)
    if ([string]$summary.Property(7) -notmatch '^x64(?:;|$)') { throw 'MSI architecture mismatch' }
    $result.machine='AMD64'
    $guid = '^\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}$'
    if ($result.ProductCode -notmatch $guid -or $result.UpgradeCode -notmatch $guid) { throw 'Invalid MSI product identity' }
    if ($result.ProductVersion -ne $ExpectedVersion -or $result.ProductName -ne $expectedProduct) { throw 'MSI identity mismatch' }
  } else {
    $file=[IO.File]::OpenRead($item.FullName);$reader=[IO.BinaryReader]::new($file)
    try {
      if($reader.ReadUInt16() -ne 0x5a4d){throw 'Invalid PE header'}
      $file.Position=0x3c;$offset=$reader.ReadInt32();if($offset -lt 64 -or $offset -gt 1048576){throw 'Invalid PE offset'}
      $file.Position=$offset;if($reader.ReadUInt32() -ne 0x4550){throw 'Invalid PE signature'}
      $machine=$reader.ReadUInt16()
      if($ArtifactKind -eq 'NsisInstaller'){
        if($machine -ne 0x14c){throw 'Pinned NSIS installer stub architecture mismatch'}
        $result.machine='I386'
      }else{
        if($machine -ne 0x8664){throw 'Application payload architecture mismatch'}
        $result.machine='AMD64'
      }
    }finally{$reader.Dispose();$file.Dispose()}
    $actual = $item.VersionInfo.ProductVersion
    if ($actual -ne $ExpectedVersion -and $actual -ne "$ExpectedVersion.0") { throw 'Executable version mismatch' }
    $result.ProductVersion = $actual
    $result.ProductName = $item.VersionInfo.ProductName
    if ($result.ProductName -ne $expectedProduct) { throw 'Executable product identity mismatch' }
  }
  $result | ConvertTo-Json -Compress
} else { throw 'Fixed regular installer or application executable required' }
