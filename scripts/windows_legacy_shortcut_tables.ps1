param([Parameter(Mandatory=$true)][string]$Candidate)
$ErrorActionPreference='Stop'
$installer=New-Object -ComObject WindowsInstaller.Installer
$db=$null
function Rows([string]$sql,[int]$columns) {
 $view=$db.OpenView($sql);$rows=@()
 try {$view.Execute();while($record=$view.Fetch()){$r=@();for($i=1;$i -le $columns;$i++){$r+= [string]$record.StringData($i)};$rows+=,@($r)}} finally {$view.Close()}
 return ,$rows
}
try {
 $db=$installer.OpenDatabase([IO.Path]::GetFullPath($Candidate),0)
 $shortcuts=Rows 'SELECT `Shortcut`,`Directory_`,`Name`,`Target`,`Arguments`,`Component_` FROM `Shortcut` WHERE `Shortcut`=''UninstallShortcut'''  6
 $directories=Rows 'SELECT `Directory`,`Directory_Parent`,`DefaultDir` FROM `Directory` WHERE `Directory`=''INSTALLDIR''' 3
 $sequence=Rows "SELECT ``Action``,``Condition``,``Sequence`` FROM ``InstallExecuteSequence`` WHERE ``Action``='RemoveShortcuts'" 3
 [ordered]@{shortcuts=$shortcuts;directories=$directories;removeShortcuts=$sequence;readOnly=$true}|ConvertTo-Json -Depth 8 -Compress
} finally {if($db){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($db)};[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($installer)}
