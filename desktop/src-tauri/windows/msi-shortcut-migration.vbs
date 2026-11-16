' Source for the exact inline MSI custom actions in main.wxs. No shell execution.
' Session properties are literal data; no installer path is concatenated as code.
Option Explicit
Const V19Phase = "__PHASE__"
Dim fso, shell, data, parts, expected, links, backups, i, firstLink
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
If V19Phase = "preflight" Then
  data = Session.Property("V19MigrateLegacyShortcuts")
Else
  data = Session.Property("CustomActionData")
End If
If Len(data) = 0 Or Len(data) > 163840 Then Fail "Shortcut data unavailable"
parts = Split(data, "|")
If UBound(parts) <> 4 Then Fail "Shortcut data invalid"
expected = fso.GetAbsolutePathName(parts(0))
If LCase(fso.GetFileName(expected)) <> "axiom-desktop.exe" Then Fail "Application identity invalid"
links = Array(parts(1), parts(2), parts(3), parts(4))
If LCase(fso.GetFileName(links(0))) <> "axiom agent.lnk" Then Fail "Legacy desktop identity invalid"
If LCase(fso.GetFileName(links(1))) <> "axiom agent.lnk" Then Fail "Legacy menu identity invalid"
If LCase(fso.GetFileName(links(2))) <> "v19.lnk" Then Fail "Desktop identity invalid"
If LCase(fso.GetFileName(links(3))) <> "v19.lnk" Then Fail "Menu identity invalid"
backups = Array(expected & ".v19-legacy-desktop.lnk", expected & ".v19-legacy-menu.lnk")
CheckParents expected
For i = 0 To 3
  CheckParents links(i)
Next
For i = 0 To 1
  CheckParents backups(i)
Next
Select Case V19Phase
  Case "preflight"
    ' Refuse foreign old AND current destination links before MSI changes them.
    firstLink = 0
    If Len(Session.Property("REMOVE")) > 0 Then firstLink = 2
    For i = firstLink To 3
      If fso.FolderExists(links(i)) Then Fail "Shortcut destination is a directory"
      If fso.FileExists(links(i)) Then CheckOwned links(i)
    Next
    For i = 0 To 1
      If fso.FileExists(backups(i)) Or fso.FolderExists(backups(i)) Then Fail "Shortcut backup already exists"
    Next
  Case "migrate"
    ' Recheck both source and new destinations after immediate preflight.
    For i = 0 To 3
      If fso.FolderExists(links(i)) Then Fail "Shortcut destination is a directory"
      If fso.FileExists(links(i)) Then CheckOwned links(i)
    Next
    For i = 0 To 1
      If fso.FileExists(backups(i)) Or fso.FolderExists(backups(i)) Then Fail "Shortcut backup already exists"
      If fso.FileExists(links(i)) Then
        CheckOwned links(i)
        fso.MoveFile links(i), backups(i)
      End If
    Next
  Case "rollback"
    For i = 0 To 1
      If fso.FileExists(backups(i)) Then
        CheckOwned backups(i)
        If fso.FileExists(links(i)) Or fso.FolderExists(links(i)) Then Fail "Shortcut rollback destination occupied"
        fso.MoveFile backups(i), links(i)
      End If
    Next
  Case "commit"
    For i = 0 To 1
      If fso.FileExists(backups(i)) Then
        CheckOwned backups(i)
        fso.DeleteFile backups(i), False
      End If
    Next
  Case Else
    Fail "Shortcut phase invalid"
End Select

Sub Fail(message)
  Err.Raise vbObjectError + 513, "V19 shortcut migration", message
End Sub
Sub CheckParents(value)
  Dim parent, nextParent, depth, item
  parent = fso.GetParentFolderName(fso.GetAbsolutePathName(value))
  For depth = 0 To 63
    If fso.FolderExists(parent) Then
      Set item = fso.GetFolder(parent)
      If (item.Attributes And 1024) <> 0 Then Fail "Shortcut parent is a reparse point"
    End If
    nextParent = fso.GetParentFolderName(parent)
    If Len(nextParent) = 0 Or nextParent = parent Then Exit Sub
    parent = nextParent
  Next
  Fail "Shortcut parent bound exceeded"
End Sub
Sub CheckOwned(value)
  Dim item, shortcut, target
  Set item = fso.GetFile(value)
  If (item.Attributes And 1024) <> 0 Then Fail "Shortcut is a reparse point"
  Set shortcut = shell.CreateShortcut(value)
  target = shortcut.TargetPath
  If Len(target) = 0 Then Fail "Shortcut target missing"
  If LCase(fso.GetAbsolutePathName(target)) <> LCase(expected) Then Fail "Foreign shortcut preserved"
  If shortcut.Arguments <> "" Then Fail "Shortcut arguments preserved"
End Sub
