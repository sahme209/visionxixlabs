#define _DARWIN_C_SOURCE 1
#include "origin_process_identity.h"
#include <mach-o/dyld.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
int main(void){
 char directory[]="/private/tmp/axiom-origin-identity-metadata-XXXXXX";if(!mkdtemp(directory))return 10;
 char self[PATH_MAX],resolved[PATH_MAX],file[PATH_MAX],old[PATH_MAX];uint32_t length=sizeof(self);
 if(_NSGetExecutablePath(self,&length)||!realpath(self,resolved))return 11;
 snprintf(file,sizeof(file),"%s/file.fixture",directory);snprintf(old,sizeof(old),"%s/original.fixture",directory);
 /* Observe this actual already-loaded owned test executable, not a fabricated
  * PROT_EXEC data mapping. No mapped bytes or executable permissions change. */
 if(link(resolved,file))return 12;struct stat first;if(stat(file,&first))return 13;
 if(!axiom_origin_loaded_file_matches((uintptr_t)&main,&first))return 14;
 if(rename(file,old))return 15;int fd=open(file,O_CREAT|O_EXCL|O_RDWR,0600);if(fd<0||ftruncate(fd,first.st_size))return 16;
 struct stat replacement;if(fstat(fd,&replacement))return 17;
 if(axiom_origin_same_file_metadata(&first,&replacement)||axiom_origin_loaded_file_matches((uintptr_t)&main,&replacement))return 18;
 if(!axiom_origin_loaded_file_matches((uintptr_t)&main,&first))return 19;
 struct stat changed=first;changed.st_ctimespec.tv_nsec^=1;if(axiom_origin_same_file_metadata(&first,&changed))return 20;
 changed=first;changed.st_size++;if(axiom_origin_same_file_metadata(&first,&changed))return 21;
 if(!axiom_origin_same_file_metadata(&first,&first))return 22;
 close(fd);printf("ordinary_loaded_identity_observations=5; qualification=unavailable; fixture=%s\n",directory);return 0;
}
