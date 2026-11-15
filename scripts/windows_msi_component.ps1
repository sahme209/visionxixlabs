param([Parameter(Mandatory=$true)][string]$Candidate)
$ErrorActionPreference='Stop'
$item=Get-Item -LiteralPath $Candidate
if($item.PSIsContainer -or $item.Extension -ne '.msi'){throw 'Fixed MSI required'}
$installer=New-Object -ComObject WindowsInstaller.Installer
$db=$installer.OpenDatabase($item.FullName,0)
$v=$db.OpenView('SELECT `FileName`, `Component_` FROM `File`');$v.Execute();$rows=@();$count=0
while($null -ne ($r=$v.Fetch())){
 $count++;if($count -gt 2048){throw 'MSI file bound exceeded'}
 if((($r.StringData(1) -split '\|')[-1]) -ceq 'axiom-desktop.exe'){$rows+= $r.StringData(2)}
}
$v.Close();if($rows.Count -ne 1){throw 'Exact application component ambiguous'}
$key=$rows[0];if($key.Length -gt 256){throw 'Component key too long'}
$key=$key.Replace("'","''")
$v=$db.OpenView("SELECT ``ComponentId``, ``Directory_`` FROM ``Component`` WHERE ``Component``='$key'");$v.Execute();$r=$v.Fetch()
if($null -eq $r){throw 'Application component missing'}
$guid=$r.StringData(1);$directory=$r.StringData(2)
if($guid -notmatch '^\{[0-9A-Fa-f-]{36}\}$' -or $directory -notmatch '^[A-Za-z_][A-Za-z0-9_.]{0,100}$'){throw 'Application component metadata invalid'}
if($null -ne $v.Fetch()){throw 'Component ambiguous'};$v.Close()
@{componentKey=$rows[0];componentGuid=$guid;directoryProperty=$directory;fileName='axiom-desktop.exe'} | ConvertTo-Json -Compress
