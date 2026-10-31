import Foundation
import ApplicationServices
private var nativeInputFixtureEpoch:UInt64=0
@_cdecl("axiom_input_generation") func nativeInputGenerationFixture()->UInt64{nativeInputFixtureEpoch}
// Synthetic policy and private fixture-file tests only. No native bridge, app,
// AX permission, alert, screenshot, window enumeration or document edit invoked.
@main struct InputPolicyTests {
 static func main()throws {
  var count=0
  func check(_ value:Bool){precondition(value,"one-action input policy regression");count+=1}
  check(inputActivationForegroundAllows(frontmost:10,own:10,selected:20))
  check(inputActivationForegroundAllows(frontmost:20,own:10,selected:20))
  check(!inputActivationForegroundAllows(frontmost:30,own:10,selected:20))
  check(!inputActivationForegroundAllows(frontmost:nil,own:10,selected:20))
  check(inputFixtureActivationAllows(before:"Axiom acceptance before",after:"Axiom acceptance after",fixtureConsent:true,exactConsent:true,current:true,deadline:10,now:9))
  for before in ["other","Axiom acceptance before\n"] {check(!inputFixtureActivationAllows(before:before,after:"Axiom acceptance after",fixtureConsent:true,exactConsent:true,current:true,deadline:10,now:9))}
  check(!inputFixtureActivationAllows(before:"Axiom acceptance before",after:"other",fixtureConsent:true,exactConsent:true,current:true,deadline:10,now:9))
  for flags in [(false,true,true),(true,false,true),(true,true,false)] {check(!inputFixtureActivationAllows(before:"Axiom acceptance before",after:"Axiom acceptance after",fixtureConsent:flags.0,exactConsent:flags.1,current:flags.2,deadline:10,now:9))}
  for clock in [(10.0,10.0),(10,11),(Double.infinity,9),(10,Double.nan)] {check(!inputFixtureActivationAllows(before:"Axiom acceptance before",after:"Axiom acceptance after",fixtureConsent:true,exactConsent:true,current:true,deadline:clock.0,now:clock.1))}
  check(inputEnabledBoolean(NSNumber(value:1)) == nil)
  check(inputEnabledBoolean(NSNumber(value:0)) == nil)
  check(inputEnabledBoolean("true" as CFString) == nil)
  check(inputEnabledBoolean(NSNumber(value:true)) == true)
  check(inputEnabledBoolean(NSNumber(value:false)) == false)
  check(inputEnabledBoolean(nil) == nil)
  check(inputTextWritabilityAllows(enabledStatus:.success,enabled:true,settableStatus:.success,settable:true))
  check(inputTextWritabilityAllows(enabledStatus:.attributeUnsupported,enabled:nil,settableStatus:.success,settable:true))
  for status in [AXError.success,.attributeUnsupported,.cannotComplete,.apiDisabled,.failure] {
   for enabled in [Optional<Bool>.none,Optional(false),Optional(true)] {
    for settableStatus in [AXError.success,.cannotComplete,.attributeUnsupported] {
     for settable in [false,true] {
      let expected=settableStatus == .success && settable && (status == .success && enabled == true || status == .attributeUnsupported && enabled == nil)
      check(inputTextWritabilityAllows(enabledStatus:status,enabled:enabled,settableStatus:settableStatus,settable:settable)==expected)
     }
    }
   }
  }
  check(inputPreparationRecoveryCode("axiom_not_foreground")=="native_input_foreground_required")
  check(inputPreparationRecoveryCode("text_enabled_unverified")=="native_input_text_enabled_unverified")
  check(inputPreparationRecoveryCode("text_enabled_false")=="native_input_text_disabled")
  check(inputPreparationRecoveryCode("text_area_count")=="native_input_text_area_count")
  check(inputPreparationRecoveryCode("ordinary_text_area")=="native_input_text_structure_unavailable")
  check(inputPreparationRecoveryCode("text_settable")=="native_input_text_not_editable")
  check(inputPreparationRecoveryCode("private fixture text")=="native_input_target_unavailable")
  check(inputDisposableDocumentMayPrepare(document:"",before:"ordinary",after:"edit",nativeConsent:false))
  check(!inputDisposableDocumentMayPrepare(document:"private-file",before:"Axiom acceptance before",after:"Axiom acceptance after",nativeConsent:false))
  check(inputDisposableDocumentMayPrepare(document:"private-file",before:"Axiom acceptance before",after:"Axiom acceptance after",nativeConsent:true))
  for (before,after) in [("ordinary","Axiom acceptance after"),("Axiom acceptance before","arbitrary"),("Axiom acceptance before\n","Axiom acceptance after")] {check(!inputDisposableDocumentMayPrepare(document:"private-file",before:before,after:after,nativeConsent:true))}
  let binding=AxiomInputBinding(ownerDigest:inputDigest("owned"),taskDigest:inputDigest("task1"),windowDigest:inputDigest("pid/launch/window"),targetDigest:inputDigest("TextEdit ordinary AXTextArea"),beforeDigest:inputDigest("old private document marker"),afterDigest:inputDigest("new"),inputSessionId:"input_session_11111111-1111-4111-8111-111111111111",actionId:"input_action_11111111-1111-4111-8111-111111111111",taskVersion:1)
  func gates(_ missing:Int = -1)->AxiomInputGates {AxiomInputGates(pairedOwner:missing != 0,foregroundPolicy:missing != 1,accessibility:missing != 2,ordinaryTextArea:missing != 3,windowCurrent:missing != 4,targetCurrent:missing != 5,beforeCurrent:missing != 6,nativeConfirmed:missing != 7)}
  for missing in 0..<8 {var p=AxiomInputPolicy(binding:binding,deadline:160);check(!p.claim(binding,0,100,gates(missing)));check(p.attemptCount==0)}
  for expired in [160.0,161.0,Double.infinity,Double.nan] {var p=AxiomInputPolicy(binding:binding,deadline:160);check(!p.claim(binding,0,expired,gates()))}
  var p=AxiomInputPolicy(binding:binding,deadline:160);check(p.claim(binding,0,100,gates()));check(!p.claim(binding,0,100,gates()));check(p.attemptCount==1);p.finish(binding.afterDigest,101,true);check(p.status=="confirmed")
  var lost=AxiomInputPolicy(binding:binding,deadline:160);check(lost.claim(binding,0,100,gates()));lost.finish(nil,101,true);lost.finish(binding.afterDigest,102,true);check(lost.status=="unknown");check(!lost.claim(binding,1,103,gates()))
  var stopped=AxiomInputPolicy(binding:binding,deadline:160);stopped.stop();check(!stopped.claim(binding,1,101,gates()));check(stopped.attemptCount==0)
  var late=AxiomInputPolicy(binding:binding,deadline:160);check(late.claim(binding,0,100,gates()));late.stop();late.finish(binding.afterDigest,101,true);check(late.status=="unknown")
  var timed=AxiomInputPolicy(binding:binding,deadline:160);check(timed.claim(binding,0,100,gates()));timed.finish(binding.afterDigest,111,true);check(timed.status=="unknown")
  var stale=AxiomInputPolicy(binding:binding,deadline:160);let wrong=AxiomInputBinding(ownerDigest:inputDigest("different"),taskDigest:binding.taskDigest,windowDigest:binding.windowDigest,targetDigest:binding.targetDigest,beforeDigest:binding.beforeDigest,afterDigest:binding.afterDigest,inputSessionId:binding.inputSessionId,actionId:binding.actionId,taskVersion:1);check(!stale.claim(wrong,0,100,gates()));check(!stale.claim(binding,1,100,gates()))
  check(inputValidText(String(repeating:"é",count:2048)));check(!inputValidText(String(repeating:"é",count:2049)));check(!inputValidText("secret\u{0}"));check(inputValidText(""))
  let path=URL(fileURLWithPath:"/private/tmp/axiom-input-policy-"+UUID().uuidString,isDirectory:true);try FileManager.default.createDirectory(at:path,withIntermediateDirectories:false,attributes:[.posixPermissions:0o700]);defer{try? FileManager.default.removeItem(at:path)}
  let ledger=AxiomInputLedger(directory:path),record=AxiomInputLedgerRecord(format:1,source:axiomInputSource,ownerDigest:binding.ownerDigest,taskDigest:binding.taskDigest,windowDigest:binding.windowDigest,targetDigest:binding.targetDigest,beforeDigest:binding.beforeDigest,afterDigest:binding.afterDigest,inputSessionId:binding.inputSessionId,actionId:binding.actionId,taskVersion:1,attemptCount:1,status:"unknown",revision:1)
  try ledger.claim(record);let contents=try String(contentsOf:path.appendingPathComponent(record.actionId+".json"),encoding:.utf8);check(!contents.contains("private document marker"));check(!contents.contains("beforeText"));check(try AxiomInputLedger(directory:path).recover(record.actionId,ownerDigest:record.ownerDigest,taskDigest:record.taskDigest)==record)
  do{try ledger.claim(record);check(false)}catch{check(true)}
  do{_ = try ledger.recover(record.actionId,ownerDigest:inputDigest("other-owner"),taskDigest:record.taskDigest);check(false)}catch{check(true)}
  var confirmed=record;confirmed.status="confirmed";try ledger.confirmed(confirmed);check(try ledger.recover(record.actionId,ownerDigest:record.ownerDigest,taskDigest:record.taskDigest).status=="confirmed")
  let symlinkId="input_action_22222222-2222-4222-8222-222222222222";try FileManager.default.createSymbolicLink(atPath:path.appendingPathComponent(symlinkId+".json").path,withDestinationPath:path.appendingPathComponent(record.actionId+".json").path);do{_ = try ledger.recover(symlinkId,ownerDigest:record.ownerDigest,taskDigest:record.taskDigest);check(false)}catch{check(true)}
  var traversal=AxiomInputTraversalBudget();check(traversal.visit(depth:0,childCount:2));check(traversal.visit(depth:1,childCount:0));check(traversal.complete)
  var deep=AxiomInputTraversalBudget();check(!deep.visit(depth:9,childCount:0));check(!deep.complete);check(!deep.visit(depth:0,childCount:0))
  var unreadable=AxiomInputTraversalBudget();check(!unreadable.visit(depth:1,childCount:-1));check(!unreadable.complete)
  var broad=AxiomInputTraversalBudget();check(!broad.visit(depth:1,childCount:41));check(!broad.complete)
  var exhausted=AxiomInputTraversalBudget();for _ in 0..<127{check(exhausted.visit(depth:1,childCount:0))};check(!exhausted.visit(depth:1,childCount:0));check(!exhausted.complete)
  let authorityNow=Date(timeIntervalSince1970:1900000000)
  let authorityFormatter=ISO8601DateFormatter();authorityFormatter.formatOptions=[.withInternetDateTime,.withFractionalSeconds]
  var attestation:[String:Any]=["kind":"bot_computer_owner_v1","organizationId":"org","userId":"user","sessionId":"paired","taskId":"bot_"+String(repeating:"a",count:64),"taskVersion":0,"action":"textedit_set_text","nonce":String(repeating:"a",count:64),"expiresAt":authorityFormatter.string(from:authorityNow.addingTimeInterval(14)),"_nativeDeadline":114.0]
  check(AxiomInputOwnerAuthority(attestation,now:authorityNow,uptime:100)?.deadline==114)
  attestation["action"]="textedit_read_outcome";check(AxiomInputOwnerAuthority(attestation,now:authorityNow,uptime:100)==nil);check(AxiomInputOwnerAuthority(attestation,now:authorityNow,uptime:100,purpose:.recovery)?.deadline==114)
  attestation["action"]="textedit_set_text";check(AxiomInputOwnerAuthority(attestation,now:authorityNow,uptime:100,purpose:.recovery)==nil)
  attestation["expiresAt"]=authorityFormatter.string(from:authorityNow.addingTimeInterval(16));check(AxiomInputOwnerAuthority(attestation,now:authorityNow,uptime:100)==nil)
  attestation["expiresAt"]=authorityFormatter.string(from:authorityNow.addingTimeInterval(-1));check(AxiomInputOwnerAuthority(attestation,now:authorityNow,uptime:100)==nil)
  attestation["expiresAt"]=authorityFormatter.string(from:authorityNow.addingTimeInterval(14));attestation["allowed"]=true;check(AxiomInputOwnerAuthority(attestation,now:authorityNow,uptime:100)==nil)
  attestation.removeValue(forKey:"allowed");attestation["_nativeDeadline"]=113.0;check(AxiomInputOwnerAuthority(attestation,now:authorityNow,uptime:100)?.deadline==113)
  attestation["_nativeDeadline"]=116.0;check(AxiomInputOwnerAuthority(attestation,now:authorityNow,uptime:100)==nil)
  attestation["_nativeDeadline"]=100.0;check(AxiomInputOwnerAuthority(attestation,now:authorityNow,uptime:100)==nil)
  attestation.removeValue(forKey:"_nativeDeadline");check(AxiomInputOwnerAuthority(attestation,now:authorityNow,uptime:100)==nil)
  check(inputMayDispatch(proposal:160,handoff:110,operation:110,authority:115,now:109,current:true,foreground:true))
  check(!inputMayDispatch(proposal:160,handoff:110,operation:110,authority:115,now:110,current:true,foreground:true))
  check(!inputMayDispatch(proposal:160,handoff:110,operation:110,authority:115,now:109,current:true,foreground:false))
  check(!inputMayDispatch(proposal:160,handoff:110,operation:110,authority:115,now:109,current:false,foreground:true))
  nativeInputFixtureEpoch=7;check(inputNativeGenerationCurrent(7));var effects=0;let claimedEpoch=nativeInputFixtureEpoch;nativeInputFixtureEpoch+=1
  if inputMayDispatch(proposal:160,handoff:110,operation:110,authority:115,now:109,current:inputNativeGenerationCurrent(claimedEpoch),foreground:true){effects+=1};check(effects==0);check(!inputNativeGenerationCurrent(claimedEpoch))
  print("\(count) synthetic input policy/metadata-ledger assertions passed; no AX, native alert or real input invoked")
 }
}
