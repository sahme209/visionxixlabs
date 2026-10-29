import Foundation
import AppKit
import ApplicationServices
import CommonCrypto
import Darwin
import Security

// Separate from observation. This slice has no installed paired-owner verifier
// or approved foreground input policy. No client flag/environment enables them.
@_silgen_name("axiom_input_generation") private func axiomNativeInputGeneration()->UInt64
func inputNativeGenerationCurrent(_ expected:UInt64)->Bool{axiomNativeInputGeneration()==expected}
@_cdecl("axiom_input_monotonic_now") public func axiomInputMonotonicNow()->Double{ProcessInfo.processInfo.systemUptime}
let axiomInputSource = "native_selected_window_input"
func inputDigest(_ value:String)->String {let data=Data(value.utf8);var digest=[UInt8](repeating:0,count:Int(CC_SHA256_DIGEST_LENGTH));data.withUnsafeBytes{bytes in _ = CC_SHA256(bytes.baseAddress,CC_LONG(bytes.count),&digest)};return digest.map{String(format:"%02x",$0)}.joined()}
func inputValidText(_ value:String)->Bool {value.utf8.count<=4096 && !value.unicodeScalars.contains{$0.value==0 || ($0.value<32 && $0.value != 9 && $0.value != 10) || (127...159).contains($0.value)}}
func inputOpaque(_ value:String)->Bool {!value.isEmpty && value.utf8.count<=240 && value==value.trimmingCharacters(in:.whitespacesAndNewlines) && !value.unicodeScalars.contains{$0.value<32 || (127...159).contains($0.value)}}
// Saved documents remain refused except this explicitly approved disposable fixture.
func inputDisposableDocumentMayPrepare(document:String,before:String,after:String,nativeConsent:Bool)->Bool {
    document.isEmpty || (nativeConsent && before=="Axiom acceptance before" && after=="Axiom acceptance after")
}
func inputBudget(_ deadline:TimeInterval,_ now:TimeInterval)->Bool {deadline.isFinite && now.isFinite && now<deadline}
// A skipped subtree cannot prove a unique safe input target. Exhaustion is a
// refusal, never permission to use the first text area found.
struct AxiomInputTraversalBudget {
    private(set) var visited=0
    private(set) var complete=true
    mutating func visit(depth:Int,childCount:Int)->Bool {
        guard complete,depth>=0,depth<=8,childCount>=0,childCount<=40,visited<127 else{complete=false;return false}
        visited+=1;return true
    }
}
func inputMayDispatch(proposal:TimeInterval,handoff:TimeInterval,operation:TimeInterval,authority:TimeInterval,now:TimeInterval,current:Bool,foreground:Bool)->Bool {current && foreground && [proposal,handoff,operation,authority].allSatisfy{inputBudget($0,now)}}
struct AxiomInputBinding:Equatable {
    let ownerDigest:String,taskDigest:String,windowDigest:String,targetDigest:String,beforeDigest:String,afterDigest:String
    let inputSessionId:String,actionId:String
    let taskVersion:Int
}
struct AxiomInputGates {let pairedOwner:Bool,foregroundPolicy:Bool,accessibility:Bool,ordinaryTextArea:Bool,windowCurrent:Bool,targetCurrent:Bool,beforeCurrent:Bool,nativeConfirmed:Bool}
// Native-only policy state, also exercised with synthetic gates. No text belongs
// in this state or its durable record; the native adapter keeps text in RAM only.
struct AxiomInputPolicy {
    let binding:AxiomInputBinding,deadline:TimeInterval
    private(set) var status="prepared",revision=0,attemptCount=0,acknowledgementRecorded=false
    private(set) var operationDeadline:TimeInterval?
    mutating func claim(_ expected:AxiomInputBinding,_ expectedRevision:Int,_ now:TimeInterval,_ gates:AxiomInputGates)->Bool {
        guard status=="prepared",attemptCount==0,revision==expectedRevision,binding==expected,inputBudget(deadline,now),gates.pairedOwner,gates.foregroundPolicy,gates.accessibility,gates.ordinaryTextArea,gates.windowCurrent,gates.targetCurrent,gates.beforeCurrent,gates.nativeConfirmed else{return false}
        attemptCount=1;revision+=1;status="unknown";operationDeadline=min(deadline,now+10);return true
    }
    mutating func finish(_ actualAfterDigest:String?,_ now:TimeInterval,_ current:Bool){guard attemptCount==1,status=="unknown",!acknowledgementRecorded else{return};acknowledgementRecorded=true;if current && inputBudget(deadline,now) && operationDeadline.map({inputBudget($0,now)})==true && actualAfterDigest==binding.afterDigest {status="confirmed"}}
    mutating func stop(){if attemptCount==0{status="stopped";revision+=1}else{acknowledgementRecorded=true}}
    mutating func expire(_ now:TimeInterval){if !inputBudget(deadline,now)&&attemptCount==0{status="expired";revision+=1}}
}
struct AxiomInputLedgerRecord:Codable,Equatable {
    let format:Int,source:String,ownerDigest:String,taskDigest:String,windowDigest:String,targetDigest:String,beforeDigest:String,afterDigest:String,inputSessionId:String,actionId:String,taskVersion:Int,attemptCount:Int
    var status:String,revision:Int
    var expiresAt:String?=nil
}
// Metadata only. Unknown is durably created with O_EXCL/O_NOFOLLOW + fsync
// BEFORE any OS input. Existing identity (including unknown) can never replay.
final class AxiomInputLedger {
    let directory:URL
    init(directory:URL){self.directory=directory}
    private func valid(_ r:AxiomInputLedgerRecord)->Bool {let hex=CharacterSet(charactersIn:"0123456789abcdef");return r.format==1&&r.source==axiomInputSource&&r.attemptCount==1&&r.taskVersion>=0&&r.revision>0&&["unknown","confirmed"].contains(r.status)&&[r.ownerDigest,r.taskDigest,r.windowDigest,r.targetDigest,r.beforeDigest,r.afterDigest].allSatisfy{$0.count==64 && $0.unicodeScalars.allSatisfy{hex.contains($0)}}&&r.actionId.hasPrefix("input_action_")&&UUID(uuidString:String(r.actionId.dropFirst(13))) != nil&&r.inputSessionId.hasPrefix("input_session_")&&UUID(uuidString:String(r.inputSessionId.dropFirst(14))) != nil}
    private func dirfd() throws->Int32 {var info=stat();guard lstat(directory.path,&info)==0,(info.st_mode&S_IFMT)==S_IFDIR,info.st_uid==geteuid(),info.st_mode&0o077==0 else{throw NSError(domain:"input_ledger_unavailable",code:1)};let fd=open(directory.path,O_RDONLY|O_DIRECTORY|O_NOFOLLOW);guard fd>=0 else{throw NSError(domain:"input_ledger_unavailable",code:2)};var opened=stat();guard fstat(fd,&opened)==0,opened.st_dev==info.st_dev,opened.st_ino==info.st_ino,opened.st_uid==geteuid(),opened.st_mode&0o077==0 else{close(fd);throw NSError(domain:"input_ledger_unavailable",code:3)};return fd}
    func claim(_ r:AxiomInputLedgerRecord)throws {guard valid(r),r.status=="unknown" else{throw NSError(domain:"input_ledger_invalid",code:1)};let root=try dirfd();defer{close(root)};let data=try JSONEncoder().encode(r);guard data.count<=4096 else{throw NSError(domain:"input_ledger_invalid",code:2)};let fd=openat(root,r.actionId+".json",O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW,0o600);guard fd>=0 else{throw NSError(domain:"input_ledger_claimed",code:1)};defer{close(fd)};let count=data.withUnsafeBytes{write(fd,$0.baseAddress,data.count)};guard count==data.count,fsync(fd)==0,fsync(root)==0 else{throw NSError(domain:"input_ledger_unknown",code:1)}}
    func confirmed(_ record:AxiomInputLedgerRecord)throws {guard valid(record),record.status=="confirmed" else{throw NSError(domain:"input_ledger_invalid",code:1)};let old=try recover(record.actionId,ownerDigest:record.ownerDigest,taskDigest:record.taskDigest);var expected=record;expected.status="unknown";guard old==expected else{throw NSError(domain:"input_ledger_changed",code:1)};let root=try dirfd();defer{close(root)};let temporary=".input-confirm-"+UUID().uuidString;let fd=openat(root,temporary,O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW,0o600);guard fd>=0 else{throw NSError(domain:"input_ledger_unknown",code:1)};defer{close(fd);unlinkat(root,temporary,0)};let data=try JSONEncoder().encode(record);let count=data.withUnsafeBytes{write(fd,$0.baseAddress,data.count)};guard count==data.count,fsync(fd)==0,renameat(root,temporary,root,record.actionId+".json")==0,fsync(root)==0 else{throw NSError(domain:"input_ledger_unknown",code:1)}}
    func recover(_ actionId:String,ownerDigest:String,taskDigest:String)throws->AxiomInputLedgerRecord {guard actionId.hasPrefix("input_action_"),UUID(uuidString:String(actionId.dropFirst(13))) != nil else{throw NSError(domain:"input_ledger_invalid",code:1)};let root=try dirfd();defer{close(root)};let fd=openat(root,actionId+".json",O_RDONLY|O_NOFOLLOW);guard fd>=0 else{throw NSError(domain:"input_ledger_unavailable",code:1)};defer{close(fd)};var info=stat();guard fstat(fd,&info)==0,(info.st_mode&S_IFMT)==S_IFREG,info.st_uid==geteuid(),info.st_mode&0o077==0,info.st_nlink==1,info.st_size>0,info.st_size<=4096 else{throw NSError(domain:"input_ledger_invalid",code:1)};let length=Int(info.st_size);var bytes=[UInt8](repeating:0,count:length);let count=bytes.withUnsafeMutableBytes{read(fd,$0.baseAddress,length)};guard count==bytes.count else{throw NSError(domain:"input_ledger_invalid",code:1)};let record=try JSONDecoder().decode(AxiomInputLedgerRecord.self,from:Data(bytes));guard valid(record),record.actionId==actionId,record.ownerDigest==ownerDigest,record.taskDigest==taskDigest else{throw NSError(domain:"input_ledger_owner_changed",code:1)};return record}
}

@available(macOS 15.2,*)
@MainActor private final class AxiomTextEditTarget {
    let element:AXUIElement,window:AXUIElement,selection:AxiomSelectedWindowIdentity,before:String,targetDigest:String,documentDigest:String
    private static func signedTextEdit(_ pid:pid_t)->Bool {var code:SecCode?,requirement:SecRequirement?;guard SecCodeCopyGuestWithAttributes(nil,[kSecGuestAttributePid as String:pid] as CFDictionary,SecCSFlags(rawValue:0),&code)==errSecSuccess,SecRequirementCreateWithString("anchor apple and identifier \"com.apple.TextEdit\"" as CFString,SecCSFlags(rawValue:0),&requirement)==errSecSuccess,let code=code,let requirement=requirement else{return false};return SecCodeCheckValidity(code,SecCSFlags(rawValue:0),requirement)==errSecSuccess}
    init(selection:AxiomSelectedWindowIdentity,requestedAfter:String)throws {
        guard Self.signedTextEdit(selection.pid),AXIsProcessTrusted(),let process=NSRunningApplication(processIdentifier:selection.pid),process.bundleIdentifier=="com.apple.TextEdit",process.launchDate==selection.launchDate,!process.isTerminated else{throw NSError(domain:"native_input_target_unavailable",code:1)}
        self.selection=selection
        let app=AXUIElementCreateApplication(selection.pid);AXUIElementSetMessagingTimeout(app,1)
        guard let windows=Self.attribute(app,kAXWindowsAttribute as CFString) as? [AXUIElement],windows.count<=20 else{throw NSError(domain:"native_input_target_unavailable",code:2)}
        let matches=windows.filter{Self.matches($0,selection)};guard matches.count==1,let window=matches.first else{throw NSError(domain:"native_input_ambiguous_window",code:1)};let document=Self.attribute(window,kAXDocumentAttribute as CFString) as? String ?? "";self.window=window
        var nodes:[AXUIElement]=[],traversal=AxiomInputTraversalBudget()
        func walk(_ node:AXUIElement,_ depth:Int){var raw:CFTypeRef?;let read=AXUIElementCopyAttributeValue(node,kAXChildrenAttribute as CFString,&raw);let children:[AXUIElement];if read == .attributeUnsupported || read == .noValue {children=[]}else if read == .success,let found=raw as? [AXUIElement]{children=found}else{_ = traversal.visit(depth:depth,childCount:-1);return};guard traversal.visit(depth:depth,childCount:children.count) else{return};if Self.attribute(node,kAXRoleAttribute as CFString) as? String==kAXTextAreaRole {nodes.append(node)};for child in children{walk(child,depth+1)}}
        walk(window,0);guard traversal.complete,nodes.count==1,let target=nodes.first,Self.attribute(target,kAXSubroleAttribute as CFString) as? String != kAXSecureTextFieldSubrole,Self.attribute(target,kAXEnabledAttribute as CFString) as? Bool==true,let before=Self.attribute(target,kAXValueAttribute as CFString) as? String,before.utf8.count<=4096 else{throw NSError(domain:"native_input_target_unavailable",code:3)}
        var settable=DarwinBoolean(false);guard AXUIElementIsAttributeSettable(target,kAXValueAttribute as CFString,&settable) == .success,settable.boolValue else{throw NSError(domain:"native_input_target_unavailable",code:4)}
        var fixtureConsent=false
        if !document.isEmpty {
            guard before=="Axiom acceptance before",requestedAfter=="Axiom acceptance after",NSApplication.shared.isActive else{throw NSError(domain:"native_input_saved_document",code:1)}
            let review=NSAlert();review.messageText="Allow this disposable TextEdit test once?";review.informativeText="macOS has an autosaved location for this selected document and may save the edit. Only Axiom acceptance before → Axiom acceptance after is permitted. Other saved documents remain unavailable. A separate exact-action confirmation follows.";review.addButton(withTitle:"Allow this test once");review.addButton(withTitle:"Cancel");fixtureConsent=review.runModal() == .alertFirstButtonReturn
        }
        guard inputDisposableDocumentMayPrepare(document:document,before:before,after:requestedAfter,nativeConsent:fixtureConsent),(Self.attribute(window,kAXDocumentAttribute as CFString) as? String ?? "") == document,Self.attribute(target,kAXValueAttribute as CFString) as? String==before else{throw NSError(domain:"native_input_saved_document",code:1)}
        self.documentDigest=inputDigest(document);self.element=target;self.before=before;self.targetDigest=inputDigest(selection.windowDigest+"|AXTextArea|"+inputDigest(before)+"|document|"+inputDigest(document))
    }
    private static func attribute(_ element:AXUIElement,_ attribute:CFString)->CFTypeRef? {var value:CFTypeRef?;guard AXUIElementCopyAttributeValue(element,attribute,&value) == .success else{return nil};return value}
    private static func matches(_ window:AXUIElement,_ s:AxiomSelectedWindowIdentity)->Bool {guard attribute(window,kAXRoleAttribute as CFString) as? String==kAXWindowRole,attribute(window,kAXTitleAttribute as CFString) as? String==s.title,let p=attribute(window,kAXPositionAttribute as CFString),CFGetTypeID(p)==AXValueGetTypeID(),let z=attribute(window,kAXSizeAttribute as CFString),CFGetTypeID(z)==AXValueGetTypeID() else{return false};var point=CGPoint.zero,size=CGSize.zero;guard AXValueGetValue(unsafeBitCast(p,to:AXValue.self),.cgPoint,&point),AXValueGetValue(unsafeBitCast(z,to:AXValue.self),.cgSize,&size) else{return false};return abs(point.x-s.bounds.origin.x)<0.5&&abs(point.y-s.bounds.origin.y)<0.5&&abs(size.width-s.bounds.width)<0.5&&abs(size.height-s.bounds.height)<0.5}
    func current(foreground:Bool)->Bool {
        guard AXIsProcessTrusted(),Self.signedTextEdit(selection.pid),let app=NSRunningApplication(processIdentifier:selection.pid),!app.isTerminated,app.launchDate==selection.launchDate,Self.matches(window,selection),inputDigest(Self.attribute(window,kAXDocumentAttribute as CFString) as? String ?? "")==documentDigest,Self.attribute(element,kAXValueAttribute as CFString) as? String==before else{return false}
        guard let rows=CGWindowListCopyWindowInfo(.optionIncludingWindow,selection.windowID) as? [[String:Any]],rows.count==1,(rows[0][kCGWindowOwnerPID as String] as? NSNumber)?.int32Value==selection.pid else{return false}
        if foreground {guard NSWorkspace.shared.frontmostApplication?.processIdentifier==selection.pid,let focused=Self.attribute(AXUIElementCreateApplication(selection.pid),kAXFocusedWindowAttribute as CFString),CFGetTypeID(focused)==AXUIElementGetTypeID(),CFEqual(focused,window) else{return false}}
        return true
    }
    // No activation, CGEvent, pasteboard, shell, browser or press operation.
    // Caller must have verified native owner authority + separately approved
    // foreground policy, native confirmation and durable single-attempt claim.
    func replaceValue(_ text:String,permit:()->Bool)->Bool {guard inputValidText(text),AXIsProcessTrusted(),Self.matches(window,selection),inputDigest(Self.attribute(window,kAXDocumentAttribute as CFString) as? String ?? "")==documentDigest,Self.attribute(element,kAXValueAttribute as CFString) as? String==before else{return false};guard permit() else{return false};guard AXUIElementSetAttributeValue(element,kAXValueAttribute as CFString,text as CFString) == .success else{return false};return Self.attribute(element,kAXValueAttribute as CFString) as? String==text}
}

@MainActor private var inputReviewAlert:NSAlert?
@available(macOS 15.2,*)
@MainActor private func inputNativeReview(targetLabel:String,before:String,after:String,deadline:TimeInterval,isCurrent:()->Bool)->Bool {
    guard NSApplication.shared.isActive,inputBudget(deadline,ProcessInfo.processInfo.systemUptime),before.utf8.count<=4096,inputValidText(after),isCurrent() else{return false}
    let alert=NSAlert();alert.messageText="Confirm one TextEdit change";alert.informativeText="Target: \(String(targetLabel.prefix(200)))\nReview the exact text below. macOS may auto-save an explicitly approved disposable test document. After applying, bring this TextEdit window to the front within 10 seconds. Axiom never activates it. Nothing is sent to AI."
    let scroll=NSScrollView(frame:NSRect(x:0,y:0,width:580,height:280));scroll.hasVerticalScroller=true;scroll.borderType = .bezelBorder
    let text=NSTextView(frame:scroll.bounds);text.isEditable=false;text.isSelectable=true;text.isRichText=false;text.importsGraphics=false;text.isAutomaticLinkDetectionEnabled=false;text.isAutomaticDataDetectionEnabled=false;text.isVerticallyResizable=true;text.isHorizontallyResizable=false;text.minSize=NSSize(width:0,height:280);text.maxSize=NSSize(width:580,height:CGFloat.greatestFiniteMagnitude);text.textContainer?.containerSize=NSSize(width:560,height:CGFloat.greatestFiniteMagnitude);text.textContainer?.widthTracksTextView=true;text.font=NSFont.monospacedSystemFont(ofSize:12,weight:.regular);text.string="BEFORE\n"+before+"\n\nAFTER\n"+after;scroll.documentView=text;alert.accessoryView=scroll
    alert.addButton(withTitle:"Apply this one change");alert.addButton(withTitle:"Cancel")
    let stop=DispatchWorkItem{[weak alert]in guard let alert=alert,alert.window.isVisible else{return};NSApplication.shared.abortModal();alert.window.orderOut(nil)};DispatchQueue.main.asyncAfter(deadline:.now()+max(0,deadline-ProcessInfo.processInfo.systemUptime),execute:stop);defer{stop.cancel()}
    inputReviewAlert=alert;defer{if inputReviewAlert === alert{inputReviewAlert=nil}};let result=alert.runModal();return result == .alertFirstButtonReturn && isCurrent() && inputBudget(deadline,ProcessInfo.processInfo.systemUptime)
}

private typealias InputReply=([String:Any]?,String?)->Void
private let inputFlags:[String:Any]=["source":axiomInputSource,"inputAvailable":false,"typeAvailable":false,"pressAvailable":false,"ownerAuthorityAvailable":false,"foregroundPolicyAvailable":false,"aiSharingAvailable":false,"backgroundInput":false]
struct AxiomInputOwnerAuthority {
    let organizationId:String,userId:String,sessionId:String,taskId:String,taskVersion:Int,deadline:TimeInterval,wallExpiry:Date
    var ownerDigest:String{inputDigest([organizationId,userId].map{String($0.utf8.count)+":"+$0}.joined())}
    var taskDigest:String{inputDigest(taskId+"|"+String(taskVersion))}
    init?(_ value:Any?,now:Date=Date(),uptime:TimeInterval=ProcessInfo.processInfo.systemUptime){
        guard let v=value as? [String:Any],Set(v.keys)==Set(["kind","organizationId","userId","sessionId","taskId","taskVersion","action","nonce","expiresAt","_nativeDeadline"]),v["kind"] as? String=="bot_computer_owner_v1",v["action"] as? String=="textedit_set_text",let org=v["organizationId"] as? String,inputOpaque(org),let user=v["userId"] as? String,inputOpaque(user),let session=v["sessionId"] as? String,inputOpaque(session),let task=v["taskId"] as? String,task.hasPrefix("bot_"),task.count==68,let version=v["taskVersion"] as? Int,version>=0,version<=2147483647,let nonce=v["nonce"] as? String,nonce.count==64,nonce.allSatisfy({$0.isHexDigit && !$0.isUppercase}),let raw=v["expiresAt"] as? String,let nativeDeadline=v["_nativeDeadline"] as? Double,nativeDeadline.isFinite,nativeDeadline>uptime,nativeDeadline<=uptime+15 else{return nil}
        let parser=ISO8601DateFormatter();parser.formatOptions=[.withInternetDateTime,.withFractionalSeconds];guard let expiry=parser.date(from:raw),expiry>now,expiry.timeIntervalSince(now)<=15 else{return nil}
        organizationId=org;userId=user;sessionId=session;taskId=task;taskVersion=version;deadline=min(nativeDeadline,uptime+expiry.timeIntervalSince(now));wallExpiry=expiry
    }
    func live()->Bool{Date()<wallExpiry && inputBudget(deadline,ProcessInfo.processInfo.systemUptime)}
}
@available(macOS 15.2,*)
@MainActor private final class AxiomWindowInput {
    static let shared=AxiomWindowInput()
    private struct Session {let owner:String,authority:AxiomInputOwnerAuthority,target:AxiomTextEditTarget,after:String,expiresAt:String,ledger:AxiomInputLedger;var policy:AxiomInputPolicy;var nativeEpoch:UInt64=0;var handoffNonce:String?=nil;var handoffDeadline:TimeInterval?=nil}
    private var session:Session?,generation:UInt64=0,pending:InputReply?,handoff:DispatchWorkItem?
    private var lifecycle:[NSObjectProtocol]=[]
    private init(){let workspace=NSWorkspace.shared.notificationCenter
        for name in [NSWorkspace.sessionDidResignActiveNotification,NSWorkspace.screensDidSleepNotification,NSWorkspace.willSleepNotification]{lifecycle.append(workspace.addObserver(forName:name,object:nil,queue:.main){[weak self]_ in Task{@MainActor in self?.stop()}})}
        lifecycle.append(workspace.addObserver(forName:NSWorkspace.didTerminateApplicationNotification,object:nil,queue:.main){[weak self]note in Task{@MainActor in guard let self=self,let app=note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication else{return};if self.session?.target.selection.pid==app.processIdentifier{self.stop()}}})
        lifecycle.append(workspace.addObserver(forName:NSWorkspace.didActivateApplicationNotification,object:nil,queue:.main){[weak self]note in Task{@MainActor in guard let self=self,let s=self.session,let app=note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication else{return};if s.handoffNonce != nil {if app.processIdentifier != s.target.selection.pid{self.stop()}}else if self.pending != nil && app.processIdentifier != s.target.selection.pid && app.processIdentifier != ProcessInfo.processInfo.processIdentifier {self.stop()}}})
        lifecycle.append(NotificationCenter.default.addObserver(forName:NSApplication.didResignActiveNotification,object:nil,queue:.main){[weak self]_ in Task{@MainActor in guard let self=self else{return};if self.pending==nil&&self.session?.handoffNonce==nil{self.stop()}}})
    }

    private func result(_ s:Session)->[String:Any]{let p=s.policy;return ["source":axiomInputSource,"inputSessionId":p.binding.inputSessionId,"actionId":p.binding.actionId,"revision":p.revision,"status":p.status,"attemptCount":p.attemptCount,"beforeDigest":p.binding.beforeDigest,"afterDigest":p.binding.afterDigest,"targetDigest":p.binding.targetDigest,"expiresAt":s.expiresAt,"inputPerformed":p.status=="confirmed" ? (true as Any) : p.attemptCount==1 ? (NSNull() as Any):(false as Any)]}
    private func stop(){generation &+= 1;if let alert=inputReviewAlert,alert.window.isVisible{NSApplication.shared.abortModal();alert.window.orderOut(nil)};handoff?.cancel();handoff=nil;if var s=session{s.policy.stop();session=s;if let reply=pending{pending=nil;reply(result(s),nil)}};session=nil}
    private func ledger(_ input:[String:Any])->AxiomInputLedger?{guard let path=input["ledgerDirectory"] as? String,path.hasPrefix("/"),path.utf8.count<4096 else{return nil};let url=URL(fileURLWithPath:path,isDirectory:true);do{try FileManager.default.createDirectory(at:url,withIntermediateDirectories:true,attributes:[.posixPermissions:0o700]);return AxiomInputLedger(directory:url)}catch{return nil}}
    func dispatch(_ operation:Int32,_ input:[String:Any],_ reply:@escaping InputReply){
        if operation==5 {stop();reply(["stopped":true],nil);return}
        if operation==3 {if let s=session,input["ownerContextRef"] as? String==s.owner,(input["inputSessionId"] is NSNull || input["inputSessionId"] as? String==s.policy.binding.inputSessionId){stop()};reply(["stopped":true],nil);return}
        let authority=AxiomInputOwnerAuthority(input["authority"])
        if operation==0 {var v=inputFlags;v["supported"]=true;v["ownerAuthorityAvailable"]=authority != nil;v["foregroundPolicyAvailable"]=true;v["typeAvailable"]=authority != nil&&AXIsProcessTrusted();v["inputAvailable"]=authority != nil&&AXIsProcessTrusted();v["reason"]=authority==nil ? "owner_authority_unavailable":AXIsProcessTrusted() ? "ready":"accessibility_unavailable";reply(v,nil);return}
        guard let auth=authority,auth.live(),input["taskId"] as? String==auth.taskId,input["taskVersion"] as? Int==auth.taskVersion else{reply(nil,"native_input_owner_authority_unavailable");return}
        guard let owner=input["ownerContextRef"] as? String,inputOpaque(owner),let ledger=ledger(input) else{reply(nil,"native_input_invalid_request");return}
        if operation==4 {guard let action=input["actionId"] as? String,let r=try? ledger.recover(action,ownerDigest:auth.ownerDigest,taskDigest:auth.taskDigest),r.expiresAt != nil else{reply(nil,"native_input_outcome_unknown");return};reply(["source":axiomInputSource,"inputSessionId":r.inputSessionId,"actionId":r.actionId,"revision":r.revision,"status":r.status,"attemptCount":r.attemptCount,"beforeDigest":r.beforeDigest,"afterDigest":r.afterDigest,"targetDigest":r.targetDigest,"expiresAt":r.expiresAt ?? "","inputPerformed":r.status=="confirmed" ? (true as Any):(NSNull() as Any)],nil);return}
        if operation==1 {guard pending==nil,NSApplication.shared.isActive,AXIsProcessTrusted(),let id=input["observationSessionId"] as? String,let revision=input["observationRevision"] as? Int,let after=input["text"] as? String,inputValidText(after),let selected=axiomSelectedWindowIdentity(ownerContextRef:owner,sessionId:id,revision:revision) else{reply(nil,"native_input_target_unavailable");return};let target:AxiomTextEditTarget;do{target=try AxiomTextEditTarget(selection:selected,requestedAfter:after)}catch{let code=(error as NSError).domain;reply(nil,["native_input_saved_document","native_input_ambiguous_window"].contains(code) ? code:"native_input_target_unavailable");return};guard target.current(foreground:false) else{reply(nil,"native_input_target_unavailable");return};stop();let uptime=ProcessInfo.processInfo.systemUptime,deadline=min(uptime+60,selected.expiresAtUptime);let formatter=ISO8601DateFormatter();formatter.formatOptions=[.withInternetDateTime,.withFractionalSeconds];let expires=formatter.string(from:Date().addingTimeInterval(deadline-uptime));let binding=AxiomInputBinding(ownerDigest:auth.ownerDigest,taskDigest:auth.taskDigest,windowDigest:selected.windowDigest,targetDigest:target.targetDigest,beforeDigest:inputDigest(target.before),afterDigest:inputDigest(after),inputSessionId:"input_session_"+UUID().uuidString.lowercased(),actionId:"input_action_"+UUID().uuidString.lowercased(),taskVersion:auth.taskVersion);guard let nativeEpoch=(input["nativeGeneration"] as? NSNumber)?.uint64Value,inputNativeGenerationCurrent(nativeEpoch) else{reply(nil,"native_input_stopped");return};let s=Session(owner:owner,authority:auth,target:target,after:after,expiresAt:expires,ledger:ledger,policy:AxiomInputPolicy(binding:binding,deadline:deadline),nativeEpoch:nativeEpoch);session=s;let epoch=generation;let expiry=DispatchWorkItem{if self.generation==epoch{self.stop()}};handoff=expiry;DispatchQueue.main.asyncAfter(deadline:.now()+max(0,deadline-uptime),execute:expiry);reply(["source":axiomInputSource,"kind":"set_text","inputSessionId":binding.inputSessionId,"actionId":binding.actionId,"revision":0,"taskId":auth.taskId,"taskVersion":auth.taskVersion,"targetLabel":"TextEdit · "+selected.title,"beforeText":target.before,"afterText":after,"beforeDigest":binding.beforeDigest,"afterDigest":binding.afterDigest,"targetDigest":binding.targetDigest,"expiresAt":expires,"attemptCount":0],nil);return}
        if operation==6 {guard pending==nil,var s=session,s.owner==owner,s.authority.ownerDigest==auth.ownerDigest,s.authority.sessionId==auth.sessionId,s.authority.taskDigest==auth.taskDigest,input["actionId"] as? String==s.policy.binding.actionId,input["inputSessionId"] as? String==s.policy.binding.inputSessionId,input["expectedRevision"] as? Int==s.policy.revision,let nonce=s.handoffNonce,input["handoffNonce"] as? String==nonce,let deadline=s.handoffDeadline,ProcessInfo.processInfo.systemUptime<deadline,auth.live(),inputNativeGenerationCurrent(s.nativeEpoch),s.target.current(foreground:true) else{reply(nil,"native_input_session_changed");return};let epoch=generation,now=ProcessInfo.processInfo.systemUptime;handoff?.cancel();handoff=nil;pending=reply;let gates=AxiomInputGates(pairedOwner:true,foregroundPolicy:true,accessibility:AXIsProcessTrusted(),ordinaryTextArea:true,windowCurrent:true,targetCurrent:true,beforeCurrent:true,nativeConfirmed:true);guard s.policy.claim(s.policy.binding,s.policy.revision,now,gates) else{self.stop();return};let b=s.policy.binding;let record=AxiomInputLedgerRecord(format:1,source:axiomInputSource,ownerDigest:b.ownerDigest,taskDigest:b.taskDigest,windowDigest:b.windowDigest,targetDigest:b.targetDigest,beforeDigest:b.beforeDigest,afterDigest:b.afterDigest,inputSessionId:b.inputSessionId,actionId:b.actionId,taskVersion:b.taskVersion,attemptCount:1,status:"unknown",revision:s.policy.revision,expiresAt:s.expiresAt);do{try s.ledger.claim(record)}catch{self.pending=nil;self.session=nil;reply(self.result(s),nil);return};guard inputMayDispatch(proposal:s.policy.deadline,handoff:deadline,operation:s.policy.operationDeadline ?? 0,authority:auth.deadline,now:ProcessInfo.processInfo.systemUptime,current:self.generation==epoch && inputNativeGenerationCurrent(s.nativeEpoch),foreground:s.target.current(foreground:true)) else{self.pending=nil;self.session=nil;reply(self.result(s),nil);return};let succeeded=s.target.replaceValue(s.after,permit:{let targetCurrent=s.target.current(foreground:true);return inputMayDispatch(proposal:s.policy.deadline,handoff:deadline,operation:s.policy.operationDeadline ?? 0,authority:auth.deadline,now:ProcessInfo.processInfo.systemUptime,current:self.generation==epoch && inputNativeGenerationCurrent(s.nativeEpoch) && targetCurrent && auth.live(),foreground:NSWorkspace.shared.frontmostApplication?.processIdentifier==s.target.selection.pid)});s.policy.finish(succeeded ? b.afterDigest:nil,ProcessInfo.processInfo.systemUptime,self.generation==epoch&&auth.live()&&NSWorkspace.shared.frontmostApplication?.processIdentifier==s.target.selection.pid);if s.policy.status=="confirmed" {var r=record;r.status="confirmed";do{try s.ledger.confirmed(r)}catch{s.policy=AxiomInputPolicy(binding:b,deadline:deadline);_ = s.policy.claim(b,0,now,gates)}};self.pending=nil;self.session=nil;reply(self.result(s),nil);return}
        guard operation==2,pending==nil,var s=session,s.owner==owner,s.authority.ownerDigest==auth.ownerDigest,s.authority.sessionId==auth.sessionId,s.authority.taskDigest==auth.taskDigest,input["actionId"] as? String==s.policy.binding.actionId,input["inputSessionId"] as? String==s.policy.binding.inputSessionId,input["expectedRevision"] as? Int==s.policy.revision,s.policy.status=="prepared",inputNativeGenerationCurrent(s.nativeEpoch),NSApplication.shared.isActive,s.target.current(foreground:false) else{reply(nil,"native_input_session_changed");return}
        let epoch=generation;let deadline=min(s.policy.deadline,auth.deadline,ProcessInfo.processInfo.systemUptime+10);pending=reply
        let approved=inputNativeReview(targetLabel:"TextEdit · "+s.target.selection.title,before:s.target.before,after:s.after,deadline:deadline,isCurrent:{self.generation==epoch&&auth.live()&&self.session?.policy.status=="prepared"&&s.target.current(foreground:false)})
        guard generation==epoch,pending != nil else{return};guard approved else{pending=nil;s.policy.stop();session=nil;reply(result(s),nil);return}
        func waitForHuman(){guard self.generation==epoch,self.pending != nil else{return};let now=ProcessInfo.processInfo.systemUptime;guard now<deadline,auth.live() else{self.pending=nil;s.policy.expire(s.policy.deadline);self.session=nil;reply(self.result(s),nil);return};let foreground=NSWorkspace.shared.frontmostApplication?.processIdentifier
            if foreground==s.target.selection.pid {guard s.target.current(foreground:true) else{self.stop();return};let nonce=UUID().uuidString.lowercased();s.handoffNonce=nonce;s.handoffDeadline=deadline;self.session=s;self.pending=nil;let expiry=DispatchWorkItem{if self.generation==epoch,self.session?.handoffNonce==nonce{self.stop()}};self.handoff=expiry;DispatchQueue.main.asyncAfter(deadline:.now()+max(0,deadline-ProcessInfo.processInfo.systemUptime),execute:expiry);reply(["source":axiomInputSource,"handoffReady":true,"inputSessionId":s.policy.binding.inputSessionId,"actionId":s.policy.binding.actionId,"handoffNonce":nonce],nil);return}
            guard foreground==ProcessInfo.processInfo.processIdentifier else{self.stop();return};let next=DispatchWorkItem{waitForHuman()};self.handoff=next;DispatchQueue.main.asyncAfter(deadline:.now()+0.05,execute:next)
        };waitForHuman()
    }
}
public typealias AxiomInputCallback = @convention(c) (UInt64,UnsafePointer<CChar>?)->Void
@_cdecl("axiom_input_request")
public func axiomInputRequest(_ operation:Int32,_ requestID:UInt64,_ input:UnsafePointer<CChar>?,_ callback:@escaping AxiomInputCallback){
    let data=input.map{Data(String(cString:$0).utf8)} ?? Data()
    let reply:InputReply={result,error in let envelope:[String:Any]=error.map{["ok":false,"error":$0]} ?? ["ok":true,"data":result ?? [:]];guard let bytes=try? JSONSerialization.data(withJSONObject:envelope),bytes.count<=24576,let json=String(data:bytes,encoding:.utf8)else{"{\"ok\":false,\"error\":\"native_input_unavailable\"}".withCString{callback(requestID,$0)};return};json.withCString{callback(requestID,$0)}}
    DispatchQueue.main.async {guard data.count<=12288,let object=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any] else{reply(nil,"native_input_invalid_request");return};if #available(macOS 15.2,*){AxiomWindowInput.shared.dispatch(operation,object,reply)}else if operation==0{var result=inputFlags;result["supported"]=false;result["reason"]="os_unsupported";reply(result,nil)}else{reply(nil,"native_input_unsupported")}}
}
