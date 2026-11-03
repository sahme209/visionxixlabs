#import <Foundation/Foundation.h>
#import <ServiceManagement/ServiceManagement.h>
#include <string.h>
#include <stdio.h>
int main(int argc,const char**argv){@autoreleasepool{
 if(argc!=2)return 64;
 SMAppService*service=[SMAppService agentServiceWithPlistName:@"com.visionxixlabs.axiom.origin-unit.plist"];NSError*error=nil;
 if(!strcmp(argv[1],"--status-reviewed-unit")){printf("%ld\n",(long)service.status);return 0;}
 if(!strcmp(argv[1],"--register-reviewed-unit"))return [service registerAndReturnError:&error]?0:70;
 if(!strcmp(argv[1],"--unregister-reviewed-unit"))return [service unregisterAndReturnError:&error]?0:71;
 return 64;
}}
