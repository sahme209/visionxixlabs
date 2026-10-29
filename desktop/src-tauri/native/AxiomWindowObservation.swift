import Foundation
import AppKit
import ScreenCaptureKit
import CoreGraphics
import ImageIO
import CommonCrypto

private func axiomObservationIdentityDigest(_ value:String)->String {let data=Data(value.utf8);var digest=[UInt8](repeating:0,count:Int(CC_SHA256_DIGEST_LENGTH));data.withUnsafeBytes{bytes in _ = CC_SHA256(bytes.baseAddress,CC_LONG(bytes.count),&digest)};return digest.map{String(format:"%02x",$0)}.joined()}
// Customer-owned, one-window read-only observer. No input, stream, disk or AI API.
// Waiting for the human picker grants no active capture/input session.
private let pickerSelectionSeconds:TimeInterval=180
private typealias Reply = ([String: Any]?, String?) -> Void
private let flags: [String: Any] = ["source":"native_selected_window", "inputAvailable":false, "aiSharingAvailable":false, "backgroundCapture":false]
private func stamp(_ date: Date) -> String { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; f.timeZone = TimeZone(secondsFromGMT:0); return f.string(from:date) }
private func string(_ value: Any?, limit: Int = 240) -> String? { guard let text=value as? String, !text.isEmpty, text.utf8.count<=limit, !text.unicodeScalars.contains(where:{$0.value<32 || (127...159).contains($0.value)}) else{return nil}; return text }
func observationBudgetValid(_ deadline:TimeInterval,_ now:TimeInterval)->Bool {deadline.isFinite && now.isFinite && now<deadline}
func observationSessionMatches(_ owner:Bool,_ session:Bool,_ revision:Bool)->Bool {owner && session && revision}
func observationSelectionRefusal(_ valid:Bool,_ busy:Bool,_ active:Bool)->String? {if !valid{return "native_observation_invalid_request"};if busy{return "native_observation_operation_busy"};if !active{return "native_observation_foreground_required"};return nil}
struct ObservationPickerHandoffPolicy {
    let epoch:UInt64,deadline:TimeInterval
    private(set) var published=false
    mutating func publish(active:Bool,currentEpoch:UInt64,now:TimeInterval)->Bool{guard !published,active,epoch==currentEpoch,observationBudgetValid(deadline,now) else{return false};published=true;return true}
}
func observationRevokeBlur(session:Bool,selecting:Bool,capture:Bool,eventEpoch:UInt64,currentEpoch:UInt64)->Bool{eventEpoch==currentEpoch && !selecting && (session || capture)}
private func keys(_ value:[String:Any], _ allowed:[String]) -> Bool { return Set(value.keys)==Set(allowed) }
private func boundedLabel(_ value:String?, fallback:String)->String { guard let value=value, !value.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty else{return fallback};let filtered=String(value.unicodeScalars.filter{$0.value>=32 && !(127...159).contains($0.value)});var result="";for character in filtered {if (result+String(character)).utf8.count>240{break};result.append(character)};return result.isEmpty ? fallback : result }

// The picker hands off a retained filter exactly once. This box only transfers
// that reference to the main actor; no filter property is read/mutated off-main.
@available(macOS 15.2, *)
private final class PickerFilterTransfer: @unchecked Sendable {let filter:SCContentFilter;init(_ filter:SCContentFilter){self.filter=filter}}
@available(macOS 15.2, *)
@MainActor private final class PickerObserver: NSObject, SCContentSharingPickerObserver {
    let epoch:UInt64;weak var owner:WindowObservation?
    init(_ owner:WindowObservation,_ epoch:UInt64){self.owner=owner;self.epoch=epoch}
    nonisolated func contentSharingPicker(_ picker:SCContentSharingPicker,didCancelFor stream:SCStream?){DispatchQueue.main.async{[weak self]in guard let self=self else{return};self.owner?.pickerCancelled(self.epoch)}}
    nonisolated func contentSharingPickerStartDidFailWithError(_ error:Error){DispatchQueue.main.async{[weak self]in guard let self=self else{return};self.owner?.pickerFailed(self.epoch)}}
    nonisolated func contentSharingPicker(_ picker:SCContentSharingPicker,didUpdateWith filter:SCContentFilter,for stream:SCStream?){let transfer=PickerFilterTransfer(filter);DispatchQueue.main.async{[weak self]in guard let self=self else{return};self.owner?.pickerUpdated(transfer.filter,self.epoch)}}
}
@available(macOS 15.2, *)
struct AxiomSelectedWindowIdentity {
    let observationSessionId:String,observationRevision:Int,ownerContextRef:String
    let pid:pid_t,launchDate:Date,windowID:CGWindowID,title:String,bounds:CGRect,expiresAtUptime:TimeInterval
    var windowDigest:String {axiomObservationIdentityDigest("\(pid)|\(launchDate.timeIntervalSince1970)|\(windowID)|\(observationSessionId)|\(observationRevision)")}
}
@available(macOS 15.2, *)
@MainActor func axiomSelectedWindowIdentity(ownerContextRef:String,sessionId:String,revision:Int)->AxiomSelectedWindowIdentity? {WindowObservation.shared.inputIdentity(ownerContextRef,sessionId,revision)}
@available(macOS 15.2, *)
@MainActor private final class WindowObservation: NSObject {
    static let shared=WindowObservation()
    private struct Session {let id:String;let owner:String;let filter:SCContentFilter;let windowID:CGWindowID;let pid:pid_t;let launchDate:Date;let appLabel:String;let windowLabel:String;let created:TimeInterval;var idle:TimeInterval;var revision:Int}
    private struct Pending {let owner:String;let select:Bool;let generation:UInt64;let deadline:TimeInterval;let reply:Reply}
    private var session:Session?,pending:Pending?,generation:UInt64=0
    private var pickerObserver:PickerObserver?
    private var pickerCandidate:Session?,pickerHandoff:ObservationPickerHandoffPolicy?
    private var timer:DispatchWorkItem?,expiry:DispatchWorkItem?
    private var tokens:[NSObjectProtocol]=[]
    private var uptime:TimeInterval {ProcessInfo.processInfo.systemUptime}
    override init(){super.init();let workspace=NSWorkspace.shared.notificationCenter
        for name in [NSWorkspace.sessionDidResignActiveNotification, NSWorkspace.screensDidSleepNotification, NSWorkspace.willSleepNotification] { tokens.append(workspace.addObserver(forName:name,object:nil,queue:.main){[weak self]_ in Task{@MainActor in self?.revoke("native_observation_operation_stopped")}}) }
        tokens.append(NotificationCenter.default.addObserver(forName:NSApplication.didResignActiveNotification,object:nil,queue:.main){[weak self]_ in MainActor.assumeIsolated{guard let self=self else{return};let epoch=self.generation;if observationRevokeBlur(session:self.session != nil,selecting:self.pending?.select==true,capture:self.pending?.select==false,eventEpoch:epoch,currentEpoch:self.generation){self.revoke("native_observation_operation_stopped")}}})
        tokens.append(NotificationCenter.default.addObserver(forName:NSApplication.didBecomeActiveNotification,object:nil,queue:.main){[weak self]_ in MainActor.assumeIsolated{self?.finalizePickerCandidate()}})
        tokens.append(workspace.addObserver(forName:NSWorkspace.didTerminateApplicationNotification,object:nil,queue:.main){[weak self]note in Task{@MainActor in guard let self=self,let app=note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication else{return};if self.session?.pid==app.processIdentifier{self.revoke("native_observation_operation_stopped")}}})
    }
    private func finish(_ data:[String:Any]?=nil,_ error:String?=nil){guard let op=pending else{return};pending=nil;timer?.cancel();timer=nil;op.reply(data,error)}
    private func pickerOff(){let picker=SCContentSharingPicker.shared;picker.isActive=false;if let observer=pickerObserver{picker.remove(observer)};pickerObserver=nil}
    private func revoke(_ code:String){generation &+= 1;expiry?.cancel();expiry=nil;session=nil;pickerCandidate=nil;pickerHandoff=nil;pickerOff();finish(nil,code)}
    private func remaining(_ s:Session)->TimeInterval {min(s.created+600,s.idle+120)-uptime}
    private func scheduleExpiry(){expiry?.cancel();guard let s=session else{return};let epoch=generation;let work=DispatchWorkItem{[weak self]in Task{@MainActor in guard let self=self,self.generation==epoch else{return};self.revoke("native_observation_session_expired")}};expiry=work;DispatchQueue.main.asyncAfter(deadline:.now()+max(0,remaining(s)),execute:work)}
    private func scheduleTimeout(_ seconds:Double){timer?.cancel();let epoch=generation;let work=DispatchWorkItem{[weak self]in Task{@MainActor in guard let self=self,self.generation==epoch,self.pending != nil else{return};self.revoke("native_observation_operation_timeout")}};timer=work;DispatchQueue.main.asyncAfter(deadline:.now()+seconds,execute:work)}
    private func live(_ s:Session)->Bool {
        guard NSApplication.shared.isActive,remaining(s)>0,let app=NSRunningApplication(processIdentifier:s.pid),!app.isTerminated,app.launchDate==s.launchDate else{return false}
        // Query only the pinned window ID, never enumerate desktop or other windows.
        guard let rows=CGWindowListCopyWindowInfo(.optionIncludingWindow,s.windowID) as? [[String:Any]],rows.count==1,let row=rows.first,(row[kCGWindowNumber as String] as? NSNumber)?.uint32Value==s.windowID,(row[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value==s.pid else{return false}
        return true
    }
    // Internal metadata-only handoff. No pixels, grant, mutation or lease renewal.
    func inputIdentity(_ owner:String,_ id:String,_ revision:Int)->AxiomSelectedWindowIdentity? {
        guard let s=session,s.owner==owner,s.id==id,s.revision==revision,pending==nil,live(s),let native=s.filter.includedWindows.first,native.windowID==s.windowID,let title=native.title,!title.isEmpty,let rows=CGWindowListCopyWindowInfo(.optionIncludingWindow,s.windowID) as? [[String:Any]],rows.count==1,let row=rows.first,let rawBounds=row[kCGWindowBounds as String] as? [String:Any],let bounds=CGRect(dictionaryRepresentation:rawBounds as CFDictionary),bounds.width>0,bounds.height>0 else{return nil}
        return AxiomSelectedWindowIdentity(observationSessionId:s.id,observationRevision:s.revision,ownerContextRef:s.owner,pid:s.pid,launchDate:s.launchDate,windowID:s.windowID,title:title,bounds:bounds,expiresAtUptime:min(s.created+600,s.idle+120))
    }
    func dispatch(_ operation:Int32,_ input:[String:Any],_ reply:@escaping Reply){
        if operation==4 {revoke("native_observation_operation_stopped");reply(["stopped":true],nil);return}
        if operation==0 {var result=flags;result["supported"]=true;reply(result,nil);return}
        guard let owner=string(input["ownerContextRef"])else{reply(nil,"native_observation_invalid_request");return}
        if operation==1 {
            if let refusal=observationSelectionRefusal(keys(input,["ownerContextRef","confirmSelect"]) && input["confirmSelect"] as? Bool==true,pending != nil,NSApplication.shared.isActive){reply(nil,refusal);return}
            revoke("native_observation_operation_stopped");pending=Pending(owner:owner,select:true,generation:generation,deadline:uptime+pickerSelectionSeconds,reply:reply)
            let picker=SCContentSharingPicker.shared;var configuration=SCContentSharingPickerConfiguration();configuration.allowedPickerModes=[.singleWindow];configuration.allowsChangingSelectedContent=false;picker.defaultConfiguration=configuration;let observer=PickerObserver(self,generation);pickerObserver=observer;picker.add(observer);picker.isActive=true;scheduleTimeout(pickerSelectionSeconds);picker.present(using:.window);return
        }
        if operation==5 {
            guard keys(input,["ownerContextRef","sessionId","expectedRevision"]),let id=string(input["sessionId"]),let revision=input["expectedRevision"] as? Int,revision>=0,revision<2147483647 else{reply(nil,"native_observation_invalid_request");return}
            // A stale or unrelated check cannot revoke a newer selection.
            guard let s=session,observationSessionMatches(s.owner==owner,s.id==id,s.revision==revision) else{reply(["current":false],nil);return}
            // Metadata liveness only; never extends either lease or tests OS capture permission.
            guard pending==nil,live(s) else{revoke("native_observation_session_changed");reply(["current":false],nil);return}
            reply(["current":true],nil);return
        }
        if operation==3 {
            guard keys(input,["ownerContextRef","sessionId"])else{reply(nil,"native_observation_invalid_request");return}
            if input["sessionId"] is NSNull {guard let p=pending,p.select,p.owner==owner else{reply(nil,"native_observation_session_changed");return};revoke("native_observation_operation_stopped");reply(["stopped":true],nil);return}
            guard let id=string(input["sessionId"]),let s=session,s.id==id,s.owner==owner else{reply(nil,"native_observation_session_changed");return};revoke("native_observation_operation_stopped");reply(["stopped":true],nil);return
        }
        guard operation==2,keys(input,["ownerContextRef","sessionId","expectedRevision","confirmCapture"]),let id=string(input["sessionId"]),let revision=input["expectedRevision"] as? Int,revision>=0,input["confirmCapture"] as? Bool==true,let s=session,s.id==id,s.owner==owner,s.revision==revision,pending==nil else{reply(nil,"native_observation_session_changed");return}
        guard remaining(s)>0 else{revoke("native_observation_session_expired");reply(nil,"native_observation_session_expired");return}
        guard live(s),s.revision<2147483647 else{revoke("native_observation_session_changed");reply(nil,"native_observation_session_changed");return}
        let epoch=generation;pending=Pending(owner:owner,select:false,generation:epoch,deadline:uptime+10,reply:reply);scheduleTimeout(10)
        let rect=s.filter.contentRect,scale=Double(s.filter.pointPixelScale)
        guard rect.width.isFinite,rect.height.isFinite,scale.isFinite,rect.width>0,rect.height>0,scale>0 else{revoke("native_observation_capture_invalid");return}
        let rawWidth=Double(rect.width)*scale,rawHeight=Double(rect.height)*scale;guard rawWidth.isFinite,rawHeight.isFinite,rawWidth>0,rawHeight>0 else{revoke("native_observation_capture_invalid");return};let ratio=min(1,1600/max(rawWidth,rawHeight));let width=max(1,Int((rawWidth*ratio).rounded(.down))),height=max(1,Int((rawHeight*ratio).rounded(.down)))
        guard width<=1600,height<=1600,width*height<=4_000_000 else{revoke("native_observation_capture_invalid");return}
        let config=SCStreamConfiguration();config.width=width;config.height=height;config.showsCursor=false;config.showMouseClicks=false;config.capturesAudio=false;config.captureMicrophone=false;config.includeChildWindows=false;config.ignoreShadowsSingleWindow=true
        SCScreenshotManager.captureImage(contentFilter:s.filter,configuration:config){[weak self]image,error in Task{@MainActor in
            guard let self=self,self.generation==epoch,self.pending?.generation==epoch,self.session?.id==s.id else{return}
            guard let deadline=self.pending?.deadline,observationBudgetValid(deadline,self.uptime) else{self.revoke("native_observation_operation_timeout");return}
            guard error==nil,let image=image,self.live(s),image.width>0,image.height>0,image.width<=1600,image.height<=1600,image.width*image.height<=4_000_000 else{self.revoke("native_observation_capture_unavailable");return}
            let bytes=NSMutableData();guard let destination=CGImageDestinationCreateWithData(bytes as CFMutableData,"public.png" as CFString,1,nil)else{self.revoke("native_observation_capture_invalid");return};CGImageDestinationAddImage(destination,image,nil);guard CGImageDestinationFinalize(destination),bytes.length<=4*1024*1024 else{self.revoke("native_observation_capture_invalid");return}
            guard self.generation==epoch,self.pending?.generation==epoch,observationBudgetValid(deadline,self.uptime),self.live(s)else{self.revoke("native_observation_operation_stopped");return}
            var next=s;next.revision+=1;next.idle=self.uptime;self.session=next;self.scheduleExpiry();var result=flags;result["sessionId"]=s.id;result["revision"]=next.revision;result["observedAt"]=stamp(Date());result["width"]=image.width;result["height"]=image.height;result["pngBase64"]=(bytes as Data).base64EncodedString();result["expiresAt"]=stamp(Date().addingTimeInterval(self.remaining(next)));self.finish(result,nil)
        }}
    }
    private func finalizePickerCandidate(){
        guard let op=pending,op.select,op.generation==generation,let candidate=pickerCandidate,var policy=pickerHandoff else{return}
        guard observationBudgetValid(policy.deadline,uptime) else{revoke("native_observation_operation_timeout");return}
        guard policy.publish(active:NSApplication.shared.isActive,currentEpoch:generation,now:uptime) else{return}
        guard live(candidate) else{revoke("native_observation_session_changed");return}
        session=candidate;pickerCandidate=nil;pickerHandoff=nil;scheduleExpiry();var result=flags;result["sessionId"]=candidate.id;result["revision"]=0;result["appLabel"]=candidate.appLabel;result["windowLabel"]=candidate.windowLabel;result["expiresAt"]=stamp(Date().addingTimeInterval(remaining(candidate)));finish(result,nil)
    }
    func pickerCancelled(_ epoch:UInt64){guard pickerCandidate==nil,pending?.select==true,pending?.generation==epoch,epoch==generation else{return};revoke("native_observation_selection_cancelled")}
    func pickerFailed(_ epoch:UInt64){guard pickerCandidate==nil,pending?.select==true,pending?.generation==epoch,epoch==generation else{return};revoke("native_observation_selection_unavailable")}
    func pickerUpdated(_ filter:SCContentFilter,_ epoch:UInt64){
        guard pickerCandidate==nil,pending?.generation==epoch,epoch==generation else{return}
        guard let deadline=pending?.deadline,observationBudgetValid(deadline,uptime) else{revoke("native_observation_operation_timeout");return}
        guard let op=pending,op.select,op.generation==generation,filter.style == .window,filter.includedWindows.count==1,let window=filter.includedWindows.first,let app=window.owningApplication,let running=NSRunningApplication(processIdentifier:app.processID),!running.isTerminated,let launched=running.launchDate else{if pending?.select==true{revoke("native_observation_selection_unavailable")};return}
        filter.includeMenuBar=false
        let s=Session(id:"observation_"+UUID().uuidString.lowercased(),owner:op.owner,filter:filter,windowID:window.windowID,pid:app.processID,launchDate:launched,appLabel:boundedLabel(app.applicationName,fallback:"Selected app"),windowLabel:boundedLabel(window.title,fallback:"Selected window"),created:uptime,idle:uptime,revision:0);pickerCandidate=s;pickerHandoff=ObservationPickerHandoffPolicy(epoch:generation,deadline:min(op.deadline,uptime+10));pickerOff();scheduleTimeout(min(10,max(0,op.deadline-uptime)));finalizePickerCandidate();if pickerCandidate != nil {NSApplication.shared.activate()}
    }
}

public typealias AxiomObservationCallback = @convention(c) (UInt64, UnsafePointer<CChar>?) -> Void
@_cdecl("axiom_observation_request")
public func axiomObservationRequest(_ operation:Int32,_ requestID:UInt64,_ input:UnsafePointer<CChar>?,_ callback:@escaping AxiomObservationCallback){
    let data=input.map{Data(String(cString:$0).utf8)} ?? Data()
    let reply:Reply={result,error in let envelope:[String:Any]=error.map{["ok":false,"error":$0]} ?? ["ok":true,"data":result ?? [:]];guard let bytes=try? JSONSerialization.data(withJSONObject:envelope),bytes.count<=6*1024*1024,let json=String(data:bytes,encoding:.utf8)else{"{\"ok\":false,\"error\":\"native_observation_capture_invalid\"}".withCString{callback(requestID,$0)};return};json.withCString{callback(requestID,$0)}}
    DispatchQueue.main.async {guard let object=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any]else{reply(nil,"native_observation_invalid_request");return};if #available(macOS 15.2,*){WindowObservation.shared.dispatch(operation,object,reply)}else if operation==0{var result=flags;result["supported"]=false;result["reason"]="os_unsupported";reply(result,nil)}else{reply(nil,"native_observation_unsupported")}}
}
