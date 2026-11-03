#import <Foundation/Foundation.h>
#import <ServiceManagement/ServiceManagement.h>
#include "config.h"
#include <string.h>
#include <stdio.h>
static int emit(NSDictionary *object,int code){NSError*error=nil;NSData*data=[NSJSONSerialization dataWithJSONObject:object options:0 error:&error];if(!data||error)return 74;if(fwrite(data.bytes,1,data.length,stdout)!=data.length||fputc('\n',stdout)==EOF||fflush(stdout))return 75;return code;}
int main(int argc,const char**argv){@autoreleasepool{
 if(argc!=2)return 64;
 NSString*operation=[NSString stringWithUTF8String:argv[1]];if(![@[@"--status-reviewed-unit",@"--register-reviewed-unit",@"--unregister-reviewed-unit"] containsObject:operation])return 64;
 NSBundle*bundle=NSBundle.mainBundle;
 NSString*app=[bundle.bundleURL.path stringByResolvingSymlinksInPath];NSString*executable=[bundle.executableURL.path stringByResolvingSymlinksInPath];NSString*identifier=bundle.bundleIdentifier;
 NSString*expectedApp=@UNIT_ROOT @"/Axiom Origin Unit.app";NSString*expectedExecutable=[expectedApp stringByAppendingString:@"/Contents/MacOS/AxiomOriginRegistrationHost"];
 BOOL bound=app&&executable&&identifier&&[app isEqualToString:expectedApp]&&[executable isEqualToString:expectedExecutable]&&[identifier isEqualToString:@"com.visionxixlabs.axiom.origin-unit.app"];
 NSMutableDictionary*receipt=[@{@"operation":operation,@"bundleURL":app?:@"unavailable",@"executableURL":executable?:@"unavailable",@"bundleIdentifier":identifier?:@"unavailable",@"exactCallingBundle":@(bound)} mutableCopy];
 if(!bound)return emit(receipt,65);
 SMAppService*service=[SMAppService agentServiceWithPlistName:@"com.visionxixlabs.axiom.origin-unit.plist"];NSError*error=nil;
 receipt[@"status"]=@(service.status);
 if([operation isEqualToString:@"--status-reviewed-unit"])return emit(receipt,0);
 if([operation isEqualToString:@"--register-reviewed-unit"]){
  SMAppServiceStatus before=service.status;receipt[@"preStatus"]=@(before);
  if(before!=SMAppServiceStatusNotRegistered&&before!=SMAppServiceStatusNotFound){receipt[@"registrationSucceeded"]=@NO;receipt[@"refusal"]=@"preexisting_or_pending_service";return emit(receipt,73);}
  BOOL registered=[service registerAndReturnError:&error];receipt[@"registrationSucceeded"]=@(registered);receipt[@"postStatus"]=@(service.status);
  if(error){receipt[@"errorDomain"]=error.domain;receipt[@"errorCode"]=@(error.code);}return emit(receipt,registered?0:70);
 }
 BOOL unregistered=[service unregisterAndReturnError:&error];receipt[@"unregistrationSucceeded"]=@(unregistered);receipt[@"postStatus"]=@(service.status);if(error){receipt[@"errorDomain"]=error.domain;receipt[@"errorCode"]=@(error.code);}return emit(receipt,unregistered?0:71);
}}
