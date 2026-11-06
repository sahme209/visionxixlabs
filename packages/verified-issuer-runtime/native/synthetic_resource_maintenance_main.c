/* Fixed trusted maintenance entry. Missing selected principals/installed identity refuse. */
#define _DARWIN_C_SOURCE 1
#include "owner_config.h"
#include "synthetic_fixture_readiness.h"
#include "synthetic_resource_provisioner.h"
#include "synthetic_fixture_producer.h"
#include "origin_process_identity.h"
#include <mach-o/dyld.h>
#include <sys/stat.h>
#include <sys/acl.h>
#include <fcntl.h>
#include <unistd.h>
#include <limits.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#define MAINTENANCE_PATH AX_SYNTH_APP "/Contents/Helpers/AxiomSyntheticProvisioner"
static int protected_fd(int fd,int directory){
 struct stat s;
 if(fstat(fd,&s)||s.st_uid!=0||(s.st_mode&0022)||(directory?!S_ISDIR(s.st_mode):(!S_ISREG(s.st_mode)||s.st_nlink!=1)))return 0;
 acl_t a=acl_get_fd_np(fd,ACL_TYPE_EXTENDED);if(!a)return 0;
 acl_entry_t entry;int count=acl_get_entry(a,ACL_FIRST_ENTRY,&entry),freed=acl_free(a);
 return count==0&&!freed;
}
static int protected_parent(void){
 int fd=open("/",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);if(fd<0)return 0;
 if(!protected_fd(fd,1)){close(fd);return 0;}
 char path[]=MAINTENANCE_PATH;char*save=NULL,*part=strtok_r(path,"/",&save);
 while(part){
  char*nextpart=strtok_r(NULL,"/",&save);
  int next=openat(fd,part,O_RDONLY|O_NOFOLLOW|O_CLOEXEC|(nextpart?O_DIRECTORY:0));int closed=close(fd);fd=-1;
  if(next<0)return 0;fd=next;
  if(closed||!protected_fd(fd,nextpart!=NULL)){close(fd);return 0;}part=nextpart;
 }
 return close(fd)==0;
}
int main(int argc,char**argv){
 (void)argv;if(argc!=1||!ax_fixture_maintenance_current())return 69;
 if(getuid()!=0||geteuid()!=0)return 70;
 char path[PATH_MAX],canonical[PATH_MAX];uint32_t length=sizeof(path);struct stat own;
 if(_NSGetExecutablePath(path,&length)||!realpath(path,canonical)||strcmp(canonical,MAINTENANCE_PATH)||!protected_parent()||lstat(MAINTENANCE_PATH,&own)||!axiom_origin_loaded_file_matches((uintptr_t)&main,&own))return 71;
 AxSyntheticProvisionResult result=ax_synthetic_native_provision();
 /* Fixed numeric statuses only: never print locator, item, key or material. */
 int provisioned=result.phase==9&&result.reason==0&&result.adds_started==3&&result.locators_published==1;
 int controller=provisioned?ax_fixture_commit_and_run_controller():0;if(!provisioned)ax_fixture_discard_authorization();
 printf("{\"phase\":%u,\"reason\":%u,\"controllerObservation\":%u}\n",result.phase,result.reason,controller?1U:0U);
 return provisioned&&controller?0:72;
}
