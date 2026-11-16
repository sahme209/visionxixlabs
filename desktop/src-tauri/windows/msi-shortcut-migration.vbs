' Exact inline MSI custom actions. Session values are data, never shell code.
Option Explicit
Const V19Phase = "__PHASE__"
Const V19UpgradeCode = "{A3C7DA37-1792-51F2-8B3A-8848B1B33F88}"
Const V19MainComponent = "{EB234B33-5646-54DC-BC0A-9794A161CA82}"
Dim fso, shell, data, parts, expected, links, backups, uninstallLinks
Dim systemMsi, currentCode, legacyCodes, currentCodes, i, firstLink, removing
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
If V19Phase = "preflight" Then
  data = ReadProperty("V19MigrateLegacyShortcuts")
Else
  data = ReadProperty("CustomActionData")
End If
If Len(data) = 0 Or Len(data) > 163840 Then Fail "Shortcut data unavailable"
parts = Split(data, "|")
If V19Phase = "preflight" Then
  If UBound(parts) <> 4 Then Fail "Shortcut data invalid"
Else
  If UBound(parts) <> 8 Then Fail "Verified shortcut data invalid"
End If
expected = fso.GetAbsolutePathName(parts(0))
If LCase(fso.GetFileName(expected)) <> "axiom-desktop.exe" Then Fail "Application identity invalid"
links = Array(parts(1), parts(2), parts(3), parts(4))
If LCase(fso.GetFileName(links(0))) <> "axiom agent.lnk" Then Fail "Legacy desktop identity invalid"
If LCase(fso.GetFileName(links(1))) <> "axiom agent.lnk" Then Fail "Legacy menu identity invalid"
If LCase(fso.GetFileName(links(2))) <> "v19.lnk" Then Fail "Desktop identity invalid"
If LCase(fso.GetFileName(links(3))) <> "v19.lnk" Then Fail "Menu identity invalid"
uninstallLinks = Array(fso.BuildPath(fso.GetParentFolderName(expected), "Uninstall Axiom Agent.lnk"), fso.BuildPath(fso.GetParentFolderName(expected), "Uninstall V19.lnk"))
backups = Array(expected & ".v19-legacy-desktop.lnk", expected & ".v19-legacy-menu.lnk", expected & ".v19-legacy-uninstall.lnk")
CheckParents expected
For i = 0 To 3
  CheckParents links(i)
Next
For i = 0 To 2
  CheckParents backups(i)
Next
For i = 0 To 1
  CheckParents uninstallLinks(i)
Next
If V19Phase = "preflight" Then
  If Len(ReadProperty("System64Folder")) = 0 Then Fail "System installer identity unavailable"
  systemMsi = fso.GetAbsolutePathName(fso.BuildPath(ReadProperty("System64Folder"), "msiexec.exe"))
  CheckParents systemMsi
  CheckRegular systemMsi
  currentCode = CanonicalGuid(ReadProperty("ProductCode"))
  CaptureRelatedOwnership
Else
  systemMsi = fso.GetAbsolutePathName(parts(5))
  If LCase(fso.GetFileName(systemMsi)) <> "msiexec.exe" Then Fail "System installer identity invalid"
  currentCode = CanonicalGuid(parts(6))
  legacyCodes = ValidatedGuidList(parts(7))
  currentCodes = ValidatedGuidList(parts(8))
  If Not HasGuid(currentCodes, currentCode) Then Fail "Current installer identity unavailable"
End If
Select Case V19Phase
  Case "preflight"
    removing = Len(ReadProperty("REMOVE")) > 0
    firstLink = 0
    If removing Then firstLink = 2
    For i = firstLink To 3
      If fso.FolderExists(links(i)) Then Fail "Shortcut destination is a directory"
      If fso.FileExists(links(i)) Then CheckOwned links(i)
    Next
    For i = 0 To 2
      If fso.FileExists(backups(i)) Or fso.FolderExists(backups(i)) Then Fail "Shortcut backup already exists"
    Next
    If Not removing Then CheckUninstallDestination uninstallLinks(0), legacyCodes
    CheckUninstallDestination uninstallLinks(1), currentCodes
    ' Overwrite deferred properties from actual installed-product observations.
    ' Public caller-supplied product lists are never consulted.
    data = Join(parts, "|") & "|" & systemMsi & "|" & currentCode & "|" & legacyCodes & "|" & currentCodes
    If Len(data) > 163840 Then Fail "Verified shortcut data invalid"
    WriteProperty "V19RollbackLegacyShortcuts", data
    WriteProperty "V19MigrateLegacyShortcuts", data
    WriteProperty "V19CommitLegacyShortcuts", data
  Case "migrate"
    For i = 0 To 3
      If fso.FolderExists(links(i)) Then Fail "Shortcut destination is a directory"
      If fso.FileExists(links(i)) Then CheckOwned links(i)
    Next
    CheckUninstallDestination uninstallLinks(0), legacyCodes
    CheckUninstallDestination uninstallLinks(1), currentCodes
    For i = 0 To 2
      If fso.FileExists(backups(i)) Or fso.FolderExists(backups(i)) Then Fail "Shortcut backup already exists"
    Next
    For i = 0 To 1
      If fso.FileExists(links(i)) Then
        CheckOwned links(i)
        fso.MoveFile links(i), backups(i)
      End If
    Next
    If fso.FileExists(uninstallLinks(0)) Then
      CheckUninstallOwned uninstallLinks(0), legacyCodes
      fso.MoveFile uninstallLinks(0), backups(2)
    End If
  Case "rollback"
    For i = 0 To 1
      If fso.FileExists(backups(i)) Then
        CheckOwned backups(i)
        If fso.FileExists(links(i)) Or fso.FolderExists(links(i)) Then Fail "Shortcut rollback destination occupied"
        fso.MoveFile backups(i), links(i)
      End If
    Next
    If fso.FileExists(backups(2)) Then
      CheckUninstallOwned backups(2), legacyCodes
      If fso.FileExists(uninstallLinks(0)) Or fso.FolderExists(uninstallLinks(0)) Then Fail "Shortcut rollback destination occupied"
      fso.MoveFile backups(2), uninstallLinks(0)
    End If
  Case "commit"
    For i = 0 To 1
      If fso.FileExists(backups(i)) Then
        CheckOwned backups(i)
        fso.DeleteFile backups(i), False
      End If
    Next
    If fso.FileExists(backups(2)) Then
      CheckUninstallOwned backups(2), legacyCodes
      fso.DeleteFile backups(2), False
    End If
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
Sub CheckRegular(value)
  Dim item
  Set item = fso.GetFile(value)
  If (item.Attributes And 1024) <> 0 Then Fail "Shortcut is a reparse point"
End Sub
Sub CheckOwned(value)
  Dim shortcut, target
  CheckRegular value
  Set shortcut = shell.CreateShortcut(value)
  target = shortcut.TargetPath
  If Len(target) = 0 Then Fail "Shortcut target missing"
  If LCase(fso.GetAbsolutePathName(target)) <> LCase(expected) Then Fail "Foreign shortcut preserved"
  If shortcut.Arguments <> "" Then Fail "Shortcut arguments preserved"
End Sub
Sub CheckUninstallDestination(value, codes)
  If fso.FolderExists(value) Then Fail "Shortcut destination is a directory"
  If fso.FileExists(value) Then CheckUninstallOwned value, codes
End Sub
Sub CheckUninstallOwned(value, codes)
  Dim shortcut, target, arguments, code
  CheckRegular value
  Set shortcut = shell.CreateShortcut(value)
  target = shortcut.TargetPath
  If Len(target) = 0 Then Fail "Shortcut target missing"
  If LCase(fso.GetAbsolutePathName(target)) <> LCase(systemMsi) Then Fail "Foreign uninstall shortcut preserved"
  arguments = shortcut.Arguments
  If Len(arguments) <> 41 Or LCase(Left(arguments, 3)) <> "/x " Then Fail "Uninstall shortcut arguments preserved"
  code = CanonicalGuid(Mid(arguments, 4))
  If Not HasGuid(codes, code) Then Fail "Foreign uninstall product preserved"
End Sub
Function CanonicalGuid(value)
  Dim pattern
  If Len(value) = 36 Then value = "{" & value & "}"
  Set pattern = New RegExp
  pattern.Pattern = "^\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}$"
  If Not pattern.Test(value) Then Fail "Installer product identity invalid"
  CanonicalGuid = UCase(value)
End Function
Function HasGuid(codes, code)
  HasGuid = InStr(1, "," & codes & ",", "," & code & ",", vbBinaryCompare) > 0
End Function
Function ValidatedGuidList(value)
  Dim entries, item, normalized
  normalized = ""
  If Len(value) > 663 Then Fail "Related product bound exceeded"
  If Len(value) > 0 Then
    entries = Split(value, ",")
    If UBound(entries) > 16 Then Fail "Related product bound exceeded"
    For Each item In entries
      item = CanonicalGuid(item)
      If HasGuid(normalized, item) Then Fail "Related product identity duplicated"
      If Len(normalized) > 0 Then normalized = normalized & ","
      normalized = normalized & item
    Next
  End If
  ValidatedGuidList = normalized
End Function
Sub CaptureRelatedOwnership
  Dim installed, item, code, productName, publisher, version, component
  legacyCodes = ""
  currentCodes = currentCode
  Set installed = RelatedProducts()
  If installed.Count > 16 Then Fail "Related product bound exceeded"
  For Each item In installed
    code = CanonicalGuid(CStr(item))
    productName = InstalledProductInfo(code, "InstalledProductName")
    publisher = InstalledProductInfo(code, "Publisher")
    version = InstalledProductInfo(code, "VersionString")
    component = InstalledComponentPath(code)
    If (productName <> "Axiom Agent" And productName <> "V19") Or publisher <> "visionxixlabs" Then Fail "Related product ownership unavailable"
    If Len(version) = 0 Or Len(version) > 64 Then Fail "Related product version unavailable"
    If Len(component) = 0 Then Fail "Related product path unavailable"
    If LCase(fso.GetAbsolutePathName(component)) <> LCase(expected) Then Fail "Related product path mismatch"
    If productName = "Axiom Agent" Then
      If HasGuid(legacyCodes, code) Then Fail "Related product identity duplicated"
      If Len(legacyCodes) > 0 Then legacyCodes = legacyCodes & ","
      legacyCodes = legacyCodes & code
    ElseIf Not HasGuid(currentCodes, code) Then
      currentCodes = currentCodes & "," & code
    End If
  Next
  legacyCodes = ValidatedGuidList(legacyCodes)
  currentCodes = ValidatedGuidList(currentCodes)
End Sub
Function ReadProperty(name)
  ReadProperty = Session.Property(name)
End Function
Sub WriteProperty(name, value)
  Session.Property(name) = value
End Sub
Function RelatedProducts()
  Set RelatedProducts = Session.Installer.RelatedProducts(V19UpgradeCode)
End Function
Function InstalledProductInfo(code, name)
  InstalledProductInfo = Session.Installer.ProductInfo(code, name)
End Function
Function InstalledComponentPath(code)
  InstalledComponentPath = Session.Installer.ComponentPath(code, V19MainComponent)
End Function
