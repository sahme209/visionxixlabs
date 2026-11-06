#define _DARWIN_C_SOURCE 1
#include "synthetic_fixture_readiness.h"
#include "owner_config.h"
#include "origin_process_identity.h"
#include <sys/stat.h>
#include <sys/acl.h>
#include <mach-o/dyld.h>
#include <limits.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
int ax_fixture_selected_principals(void){return AX_OWNER_PROFILE==AX_OWNER_PROFILE_SYSTEM&&AX_OWNER_FIXED_UID>0&&AX_OWNER_FIXED_GID>0&&AX_FIXTURE_FIXED_UID>0&&AX_FIXTURE_FIXED_GID>0&&AX_FIXTURE_FIXED_UID!=AX_OWNER_FIXED_UID;}
int ax_fixture_protected_file(const char*path,int directory){char copy[PATH_MAX],canonical[PATH_MAX];if(!path||strlen(path)>=sizeof copy||!realpath(path,canonical)||strcmp(path,canonical))return 0;strcpy(copy,path);for(;;){struct stat st;if(lstat(copy,&st)||S_ISLNK(st.st_mode)||st.st_uid||(st.st_mode&0022))return 0;if(!strcmp(copy,path)){if(directory?!S_ISDIR(st.st_mode):(!S_ISREG(st.st_mode)||st.st_nlink!=1))return 0;}else if(!S_ISDIR(st.st_mode))return 0;acl_t acl=acl_get_file(copy,ACL_TYPE_EXTENDED);if(!acl)return 0;acl_entry_t entry;int has=acl_get_entry(acl,ACL_FIRST_ENTRY,&entry),freed=acl_free(acl);if(has||freed)return 0;char*end=strrchr(copy,'/');if(!end)return 0;if(end==copy)break;*end=0;}return 1;}
int ax_fixture_maintenance_current(void){if(!ax_fixture_selected_principals()||getuid()!=0||geteuid()!=0)return 0;char raw[PATH_MAX],canonical[PATH_MAX];uint32_t n=sizeof raw;struct stat st;const char*fixed=AX_SYNTH_APP "/Contents/Helpers/AxiomSyntheticProvisioner";return !_NSGetExecutablePath(raw,&n)&&realpath(raw,canonical)&&!strcmp(canonical,fixed)&&ax_fixture_protected_file(fixed,0)&&!stat(fixed,&st)&&axiom_origin_loaded_file_matches((uintptr_t)&ax_fixture_maintenance_current,&st);}
