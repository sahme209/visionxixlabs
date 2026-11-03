#define _DARWIN_C_SOURCE 1
#include <sys/stat.h>
#include <sys/mman.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#ifndef OWNED_ROOT
#error fixed owned root required
#endif
static int denied(void){return errno==EPERM||errno==EACCES||errno==EROFS?0:-1;}
static int regular(const char *path,struct stat *s){return !lstat(path,s)&&S_ISREG(s->st_mode)&&s->st_uid==getuid();}
static int seed(const char *path){int fd=open(path,O_CREAT|O_EXCL|O_NOFOLLOW|O_WRONLY|O_CLOEXEC,0600);if(fd<0)return 0;char data[4096];memset(data,'0',sizeof(data));long page=sysconf(_SC_PAGESIZE);int ok=page>=4096&&page<=1048576&&write(fd,data,sizeof(data))==(ssize_t)sizeof(data)&&ftruncate(fd,page)==0;return close(fd)==0&&ok;}
/* Returns 1 on actual effect, 0 on refusal, -1 on ambiguous setup/cleanup. */
static int attack(const char *path,const char *rename_path,int kind){
 int fd=-1,result=0;struct stat s;if(!regular(path,&s)||s.st_size<1)return -1;
 if(kind==3)return chmod(path,0400)==0?1:denied();
 if(kind==4)return rename(path,rename_path)==0?1:denied();
 if(kind==5)return unlink(path)==0?1:denied();
 fd=open(path,O_RDWR|O_NOFOLLOW|O_CLOEXEC);if(fd<0)return denied();
 if(kind==0)result=pwrite(fd,"W",1,0)==1?1:denied();
 else if(kind==1)result=ftruncate(fd,1)==0?1:denied();
 else if(kind==2){long page=sysconf(_SC_PAGESIZE);if(page<=0||s.st_size<page){close(fd);return -1;}void *p=mmap(NULL,(size_t)page,PROT_READ|PROT_WRITE,MAP_SHARED,fd,0);if(p!=MAP_FAILED){if(mprotect(p,(size_t)page,PROT_READ)){munmap(p,(size_t)page);close(fd);return -1;}if(close(fd)){munmap(p,(size_t)page);return -1;}fd=-1;if(!mprotect(p,(size_t)page,PROT_READ|PROT_WRITE)){((volatile char*)p)[0]='M';result=1;}else result=denied();if(munmap(p,(size_t)page))return -1;}else result=denied();}
 else {close(fd);return -1;}
 if(fd>=0&&close(fd))return -1;return result;
}
int main(int argc,char **argv){
 if(argc!=2||(strcmp(argv[1],"--ordinary-control")&&strcmp(argv[1],"--resource")))return 64;
 struct stat root;if(lstat(OWNED_ROOT,&root)||!S_ISDIR(root.st_mode)||root.st_uid!=getuid()||(root.st_mode&0777)!=0700)return 65;
 int control=!strcmp(argv[1],"--ordinary-control");char path[1024],alias[1024],renamed[1024];const char *names[]={"write","truncate","closed_fd_shared_upgrade","metadata","rename","unlink"};
 for(int kind=0;kind<6;kind++){
  if(control){snprintf(path,sizeof(path),"%s/control-%d",OWNED_ROOT,kind);snprintf(alias,sizeof(alias),"%s/control-%d-alias",OWNED_ROOT,kind);if(!seed(path)||link(path,alias))return 66;}
  else {snprintf(path,sizeof(path),"%s/package.dmg",OWNED_ROOT);snprintf(alias,sizeof(alias),"%s/package-hardlink.dmg",OWNED_ROOT);}
  snprintf(renamed,sizeof(renamed),"%s/renamed-%d",OWNED_ROOT,kind);
  struct stat a,b;if(!regular(path,&a)||!regular(alias,&b)||a.st_dev!=b.st_dev||a.st_ino!=b.st_ino)return 67;
  int result=attack(kind%2?alias:path,renamed,kind);printf("operation=%s effect=%d scope=%s identity=unavailable\n",names[kind],result,control?"ordinary_control":"actual_owned_image");fflush(stdout);
  if(control){/* Only this explicitly owned ordinary seed is cleaned; no image cleanup here. */
   if(kind==4){if(unlink(renamed))return 68;}else if(kind!=5&&unlink(path))return 68;
   if(unlink(alias)&&errno!=ENOENT)return 68;
   /* Odd-kind attacks may rename/unlink the alias, leaving the original seed. */
   if(unlink(path)&&errno!=ENOENT)return 68;
   if(result!=1)return 69;
  }else if(result!=0)return result==1?20:21; /* stop before a changed/truncated image can be mapped */
 }
 if(!control){snprintf(path,sizeof(path),"%s/mount/.next/BUILD_ID",OWNED_ROOT);snprintf(renamed,sizeof(renamed),"%s/mounted-renamed",OWNED_ROOT);int result=attack(path,renamed,0);printf("operation=mounted_package_write effect=%d scope=actual_mounted_package identity=unavailable\n",result);if(result!=0)return result==1?20:21;}
 puts("resource_identity=unavailable qualification=feasibility_only");return 0;
}
