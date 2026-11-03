#import <Foundation/Foundation.h>
#import <ServiceManagement/ServiceManagement.h>
#include "config.h"
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <limits.h>
#include <sys/stat.h>
#include <mach-o/dyld.h>
static int emit(NSDictionary *object,int code){NSError*error=nil;NSData*data=[NSJSONSerialization dataWithJSONObject:object options:0 error:&error];if(!data||error)return 74;if(fwrite(data.bytes,1,data.length,stdout)!=data.length||fputc('\n',stdout)==EOF||fflush(stdout))return 75;return code;}
static NSString* canonical(NSString*path){char resolved[PATH_MAX];return path&&realpath(path.fileSystemRepresentation,resolved)?[NSString stringWithUTF8String:resolved]:nil;}
static BOOL sameObject(NSString*a,NSString*b){struct stat first,second;return a&&b&&stat(a.fileSystemRepresentation,&first)==0&&stat(b.fileSystemRepresentation,&second)==0&&first.st_dev==second.st_dev&&first.st_ino==second.st_ino;}
int main(int argc,const char**argv){@autoreleasepool{
 if(argc!=2)return 64;
 NSString*operation=[NSString stringWithUTF8String:argv[1]];if(![@[@"--inspect-reviewed-unit",@"--status-reviewed-unit",@"--register-reviewed-unit",@"--unregister-reviewed-unit"] containsObject:operation])return 64;
 NSBundle*bundle=NSBundle.mainBundle;
 NSString*rawApp=bundle.bundleURL.path;NSString*rawExecutable=bundle.executableURL.path;NSString*identifier=bundle.bundleIdentifier;
 NSString*app=canonical(rawApp);NSString*declaredExecutable=canonical(rawExecutable);
 char processPath[PATH_MAX];uint32_t processPathSize=sizeof(processPath);NSString*executable=_NSGetExecutablePath(processPath,&processPathSize)==0?canonical([NSString stringWithUTF8String:processPath]):nil;
 NSString*expectedApp=canonical(@UNIT_ROOT @"/Axiom Origin Unit.app");NSString*expectedExecutable=canonical(@UNIT_ROOT @"/Axiom Origin Unit.app/Contents/MacOS/AxiomOriginRegistrationHost");
 BOOL bound=app&&declaredExecutable&&executable&&expectedApp&&expectedExecutable&&identifier&&[app isEqualToString:expectedApp]&&sameObject(app,expectedApp)&&[declaredExecutable isEqualToString:expectedExecutable]&&sameObject(declaredExecutable,expectedExecutable)&&[executable isEqualToString:expectedExecutable]&&sameObject(executable,expectedExecutable)&&[identifier isEqualToString:@"com.visionxixlabs.axiom.origin-unit.app"];
 NSMutableDictionary*receipt=[@{@"operation":operation,@"rawBundleURL":rawApp?:@"unavailable",@"rawDeclaredExecutableURL":rawExecutable?:@"unavailable",@"bundleURL":app?:@"unavailable",@"executableURL":executable?:@"unavailable",@"declaredExecutableURL":declaredExecutable?:@"unavailable",@"bundleIdentifier":identifier?:@"unavailable",@"exactCallingBundle":@(bound)} mutableCopy];
 if(!bound)return emit(receipt,65);
 // Ordinary Foundation/filesystem inspection returns before any SMAppService API.
 if([operation isEqualToString:@"--inspect-reviewed-unit"]){receipt[@"serviceManagementAccessed"]=@NO;return emit(receipt,0);}
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
