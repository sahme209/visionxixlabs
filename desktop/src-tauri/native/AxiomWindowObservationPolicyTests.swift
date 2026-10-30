import Foundation
// Pure policy executable. Never calls the bridge, picker, AppKit app or capture.
@main struct ObservationPolicyTests {static func main(){
 let cases:[(Double,Double,Bool)]=[(110,100,true),(110,109.999,true),(110,110,false),(110,110.001,false),(160,159.999,true),(160,160,false),(.infinity,100,false),(110,.nan,false)]
 for(deadline,now,expected)in cases{precondition(observationBudgetValid(deadline,now)==expected,"monotonic operation budget regression")}
 for (valid,busy,active,expected) in [(false,false,true,"native_observation_invalid_request"),(true,true,true,"native_observation_operation_busy"),(true,false,false,"native_observation_foreground_required"),(true,false,true,"")] {precondition((observationSelectionRefusal(valid,busy,active) ?? "")==expected)}
 for (sameOwner,sameSession,sameRevision,expected) in [(true,true,true,true),(false,true,true,false),(true,false,true,false),(true,true,false,false)]{precondition(observationSessionMatches(sameOwner,sameSession,sameRevision)==expected)}
 var handoff=ObservationPickerHandoffPolicy(epoch:7,deadline:110)
 precondition(!handoff.publish(active:false,currentEpoch:7,now:100));precondition(!handoff.published)
 precondition(!handoff.publish(active:true,currentEpoch:6,now:101));precondition(!handoff.published)
 precondition(handoff.publish(active:true,currentEpoch:7,now:102));precondition(handoff.published)
 precondition(!handoff.publish(active:true,currentEpoch:7,now:103))
 var late=ObservationPickerHandoffPolicy(epoch:7,deadline:110);precondition(!late.publish(active:true,currentEpoch:7,now:110))
 precondition(!observationRevokeBlur(session:false,selecting:true,capture:false,eventEpoch:7,currentEpoch:7))
 precondition(!observationRevokeBlur(session:true,selecting:false,capture:false,eventEpoch:6,currentEpoch:7))
 precondition(!observationRevokeBlur(session:true,selecting:false,capture:false,eventEpoch:7,currentEpoch:7))
 precondition(observationRevokeBlur(session:false,selecting:false,capture:true,eventEpoch:7,currentEpoch:7))
 print("4 session-match, 8 deadline, 4 selection-refusal and 12 picker/focus assertions passed; no native observation invoked")
}}
