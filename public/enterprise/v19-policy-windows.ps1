<#
.SYNOPSIS
  Writes the V19 organization settings file on a Windows computer.
.DESCRIPTION
  Run as SYSTEM or an administrator (for example as an Intune platform script or a Configuration Manager
  script). Writes %ProgramData%\VisionXIXLabs\V19\policy.json as UTF-8 without a byte-order mark, and
  sets the folder so only Administrators and SYSTEM can change it while everyone else can read it.
.EXAMPLE
  .\v19-policy-windows.ps1 -ManagedBy "Example Health IT" -AllowedWorkspaceIds org_abc,org_def -UpdateNotices $false
#>
param(
  [string]$ManagedBy = "",
  [string[]]$AllowedWorkspaceIds = @(),
  [Nullable[bool]]$UpdateNotices = $null,
  [string]$ServerUrl = "",
  [string]$Path = (Join-Path $env:ProgramData "VisionXIXLabs\V19\policy.json")
)
$ErrorActionPreference = "Stop"
$policy = [ordered]@{}
if ($ManagedBy) {
  if ($ManagedBy.Length -gt 80 -or $ManagedBy -match '[\x00-\x1f]') { throw "ManagedBy must be 80 characters or fewer, on one line." }
  $policy.managedBy = $ManagedBy.Trim()
}
$ids = @($AllowedWorkspaceIds | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -Unique)
if ($ids.Count -gt 0) {
  if ($ids.Count -gt 50) { throw "Give at most 50 workspace IDs." }
  foreach ($id in $ids) { if ($id -notmatch '^[A-Za-z0-9_-]{1,64}$') { throw "Workspace ID '$id' is not valid." } }
  $policy.allowedWorkspaceIds = $ids
}
if ($null -ne $UpdateNotices) { $policy.updateNotices = [bool]$UpdateNotices }
if ($ServerUrl) {
  if ($ServerUrl -notmatch '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/?$') { throw "ServerUrl must be https://host or https://host:port." }
  $policy.serverUrl = $ServerUrl.TrimEnd('/')
}
$json = if ($policy.Count -eq 0) { "{}" } else { ConvertTo-Json -InputObject $policy -Depth 3 }
# A single workspace ID must stay an array in the file.
if ($ids.Count -eq 1) { $json = $json -replace '"allowedWorkspaceIds":\s*"([^"]+)"', '"allowedWorkspaceIds": ["$1"]' }
$dir = Split-Path -Parent $Path
New-Item -ItemType Directory -Force -Path $dir | Out-Null
if ($IsWindows -or $PSVersionTable.PSEdition -eq "Desktop") {
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
$inherit = [System.Security.AccessControl.InheritanceFlags]"ContainerInherit,ObjectInherit"
$none = [System.Security.AccessControl.PropagationFlags]::None
foreach ($rule in @(
  @("*S-1-5-32-544", "FullControl"),   # Administrators
  @("*S-1-5-18", "FullControl"),       # SYSTEM
  @("*S-1-5-32-545", "ReadAndExecute") # Users
)) {
  $sid = New-Object System.Security.Principal.SecurityIdentifier($rule[0].TrimStart('*'))
  $acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($sid, $rule[1], $inherit, $none, "Allow")))
}
Set-Acl -Path $dir -AclObject $acl
}
$tmp = "$Path.tmp"
[System.IO.File]::WriteAllText($tmp, $json + "`n", (New-Object System.Text.UTF8Encoding($false)))
Move-Item -Force -Path $tmp -Destination $Path
Write-Output "V19 policy written to $Path"
