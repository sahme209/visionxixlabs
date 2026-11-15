/* Fixed administrative operational startup. Source preparation, NOT installed
 * qualification. Root is trusted; no defense against malicious root is claimed.
 * Missing masks/suspend evidence/package files refuse before accepting requests. */
#define _GNU_SOURCE
#include "time_operational_status.h"
#include "runtime_profile.h"
#include <sys/stat.h>
#include <sys/xattr.h>
#include <sys/wait.h>
#include <sys/syscall.h>
#include <sys/prctl.h>
#include <sys/random.h>
#include <fcntl.h>
#include <dirent.h>
#include <grp.h>
#include <poll.h>
#include <unistd.h>
#include <signal.h>
#include <string.h>
#include <stdlib.h>
#include <errno.h>
#include <limits.h>
#include <stdio.h>
#include <time.h>


/* Exact output identities are supplied by the separately reviewed package
 * materializer. Empty defaults REFUSE; a 64-hex acceptance field is not proof. */
#ifndef AXIOM_OPERATIONAL_PROFILE_SHA256
#define AXIOM_OPERATIONAL_PROFILE_SHA256 ""
#endif
#ifndef AXIOM_OPERATIONAL_DAEMON_SHA256
#define AXIOM_OPERATIONAL_DAEMON_SHA256 ""
#endif
#ifndef AXIOM_OPERATIONAL_NODE_SHA256
#define AXIOM_OPERATIONAL_NODE_SHA256 ""
#endif
#ifndef AXIOM_OPERATIONAL_WORKER_SHA256
#define AXIOM_OPERATIONAL_WORKER_SHA256 ""
#endif
#ifndef AXIOM_OPERATIONAL_PRIVATE_MAIN_SHA256
#define AXIOM_OPERATIONAL_PRIVATE_MAIN_SHA256 ""
#endif
#ifndef AXIOM_OPERATIONAL_ADDON_SHA256
#define AXIOM_OPERATIONAL_ADDON_SHA256 ""
#endif
struct frozen_file {const char *path,*digest;int fd;struct stat original;};
static struct frozen_file frozen[]={
 {"/etc/axiom-operational-time/profile",AXIOM_OPERATIONAL_PROFILE_SHA256,-1,{0}},
 {"/opt/axiom-operational-time/bin/time_daemon",AXIOM_OPERATIONAL_DAEMON_SHA256,-1,{0}},
 {"/opt/axiom-operational-time/bin/node",AXIOM_OPERATIONAL_NODE_SHA256,-1,{0}},
 {"/opt/axiom-operational-time/bin/time_worker",AXIOM_OPERATIONAL_WORKER_SHA256,-1,{0}},
 {"/opt/axiom-operational-time/private/main.mjs",AXIOM_OPERATIONAL_PRIVATE_MAIN_SHA256,-1,{0}},
 {"/opt/axiom-operational-time/private/operational.node",AXIOM_OPERATIONAL_ADDON_SHA256,-1,{0}},
};
/* SHA-256 over original held FD, no external process/crypto dependency. This
 * uncompiled implementation needs actual known-vector/native qualification. */
static uint32_t rotate(uint32_t x,unsigned n){return(x>>n)|(x<<(32-n));}
static void sha_block(uint32_t state[8],const unsigned char b[64]){
 static const uint32_t k[64]={
 0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
 0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
 0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
 0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
 0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
 0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
 0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
 0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2};
 uint32_t w[64];for(unsigned i=0;i<16;i++)w[i]=(uint32_t)b[4*i]<<24|(uint32_t)b[4*i+1]<<16|(uint32_t)b[4*i+2]<<8|b[4*i+3];
 for(unsigned i=16;i<64;i++){uint32_t a=rotate(w[i-15],7)^rotate(w[i-15],18)^(w[i-15]>>3),z=rotate(w[i-2],17)^rotate(w[i-2],19)^(w[i-2]>>10);w[i]=w[i-16]+a+w[i-7]+z;}
 uint32_t a=state[0],b0=state[1],c=state[2],d=state[3],e=state[4],f=state[5],g=state[6],h=state[7];
 for(unsigned i=0;i<64;i++){uint32_t t=h+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^((~e)&g))+k[i]+w[i];uint32_t u=(rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b0)^(a&c)^(b0&c));h=g;g=f;f=e;e=d+t;d=c;c=b0;b0=a;a=t+u;}
 uint32_t result[8]={a,b0,c,d,e,f,g,h};for(unsigned i=0;i<8;i++)state[i]+=result[i];
}
static int hash_fd(int fd,const char *expected){
 if(strlen(expected)!=64)return -1;for(unsigned i=0;i<64;i++)if(!((expected[i]>='0'&&expected[i]<='9')||(expected[i]>='a'&&expected[i]<='f')))return -1;
 struct stat before,after;if(fstat(fd,&before)||before.st_size<1||before.st_size>1073741824)return -1;
 uint32_t state[8]={0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19};
 unsigned char block[64];uint64_t offset=0;size_t used=0;
 while(offset<(uint64_t)before.st_size){ssize_t n=pread(fd,block+used,64-used,(off_t)offset);if(n<=0)return -1;offset+=(uint64_t)n;used+=(size_t)n;if(used==64){sha_block(state,block);used=0;}}
 block[used++]=0x80;if(used>56){memset(block+used,0,64-used);sha_block(state,block);used=0;}memset(block+used,0,56-used);uint64_t bits=offset*8;for(unsigned i=0;i<8;i++)block[63-i]=(unsigned char)(bits>>(8*i));sha_block(state,block);
 char hex[65];for(unsigned i=0;i<8;i++)snprintf(hex+8*i,9,"%08x",state[i]);
 if(fstat(fd,&after)||before.st_dev!=after.st_dev||before.st_ino!=after.st_ino||before.st_size!=after.st_size||before.st_mtim.tv_sec!=after.st_mtim.tv_sec||before.st_mtim.tv_nsec!=after.st_mtim.tv_nsec||before.st_ctim.tv_sec!=after.st_ctim.tv_sec||before.st_ctim.tv_nsec!=after.st_ctim.tv_nsec)return -1;
 return strcmp(hex,expected)?-1:0;
}
static const char directory_path[]="/run/axiom-operational-time/generation-1";
static const char policy_path[]="/etc/axiom-operational-time/profile";
static const char daemon_path[]="/opt/axiom-operational-time/bin/time_daemon";
static const char node_path[]="/opt/axiom-operational-time/bin/node";
static int uid_fd=-1;static struct stat uid_stat;static char accepted_uid[32];
static volatile sig_atomic_t withdrawing;
static void withdraw(int sig){(void)sig;withdrawing=1;}
static int no_acl(int fd){errno=0;return fgetxattr(fd,"system.posix_acl_access",NULL,0)<0&&errno==ENODATA;}
static int protected_ancestors(const char *path){
 char prefix[512];size_t length=strlen(path);if(!length||length>=sizeof prefix||path[0]!='/')return -1;
 memcpy(prefix,path,length+1);for(size_t i=1;i<length;i++)if(prefix[i]=='/'){prefix[i]=0;struct stat st;int bad=lstat(prefix,&st)||!S_ISDIR(st.st_mode)||st.st_uid!=0||(st.st_mode&0022);prefix[i]='/';if(bad)return -1;}return 0;
}
static int protected_file(const char*path,struct stat*identity){
 if(protected_ancestors(path))return -1;int fd=open(path,O_RDONLY|O_NOFOLLOW|O_CLOEXEC);struct stat s;
 if(fd<0||fstat(fd,&s)||!S_ISREG(s.st_mode)||s.st_uid!=0||s.st_nlink!=1||(s.st_mode&0022)||!no_acl(fd)){if(fd>=0)close(fd);return -1;}
 if(identity)*identity=s;return fd;
}
static int frozen_current(void);
static int unchanged(const char*path,int fd){struct stat a,b;return fstat(fd,&a)||lstat(path,&b)||a.st_dev!=b.st_dev||a.st_ino!=b.st_ino||a.st_size!=b.st_size||a.st_mode!=b.st_mode||a.st_mtim.tv_sec!=b.st_mtim.tv_sec||a.st_mtim.tv_nsec!=b.st_mtim.tv_nsec||a.st_ctim.tv_sec!=b.st_ctim.tv_sec||a.st_ctim.tv_nsec!=b.st_ctim.tv_nsec||b.st_uid!=0?-1:0;}
/* Startup verifies expected digests on original FDs. Every response checks the
 * exact original inode+size+mode+mtime+ctime and named binding. A normal content
 * edit changes ctime even if mtime is restored; malicious root is out of model. */
static int frozen_current(void){
 for(size_t i=0;i<sizeof frozen/sizeof frozen[0];i++){
  struct frozen_file*f=&frozen[i];struct stat now;
  if(f->fd<0||fstat(f->fd,&now)||now.st_dev!=f->original.st_dev||now.st_ino!=f->original.st_ino||now.st_size!=f->original.st_size||now.st_mode!=f->original.st_mode||now.st_mtim.tv_sec!=f->original.st_mtim.tv_sec||now.st_mtim.tv_nsec!=f->original.st_mtim.tv_nsec||now.st_ctim.tv_sec!=f->original.st_ctim.tv_sec||now.st_ctim.tv_nsec!=f->original.st_ctim.tv_nsec||unchanged(f->path,f->fd)||!no_acl(f->fd))return -1;
 }
 struct stat u;char value[32]={0};ssize_t n=uid_fd>=0?pread(uid_fd,value,sizeof value-1,0):-1;
 if(n<2||value[n-1]!='\n'||fstat(uid_fd,&u)||u.st_dev!=uid_stat.st_dev||u.st_ino!=uid_stat.st_ino||u.st_size!=uid_stat.st_size||u.st_ctim.tv_sec!=uid_stat.st_ctim.tv_sec||u.st_ctim.tv_nsec!=uid_stat.st_ctim.tv_nsec||unchanged("/etc/axiom-operational-time/reader-uid",uid_fd))return -1;
 value[n-1]=0;return strcmp(value,accepted_uid)?-1:0;
}
static int read_scalar(const char*path,char*b,size_t cap){int fd=open(path,O_RDONLY|O_NOFOLLOW|O_CLOEXEC);if(fd<0)return -1;ssize_t n=read(fd,b,cap);int result=close(fd);if(result||n<2||(size_t)n>=cap||b[n-1]!='\n')return -1;b[n-1]=0;return 0;}
static int masked(const char*name){
 char path[256],target[64];const char*dirs[]={"/run/systemd/system/","/etc/systemd/system/"};
 for(size_t i=0;i<2;i++){size_t n=strlen(dirs[i])+strlen(name);if(n>=sizeof path)return -1;strcpy(path,dirs[i]);strcat(path,name);struct stat s;if(lstat(path,&s)==0&&S_ISLNK(s.st_mode)&&s.st_uid==0){ssize_t got=readlink(path,target,sizeof target);if(got==9&&!memcmp(target,"/dev/null",9))return 0;}}
 return -1;
}
static int services_stopped(void){
 if(masked("chronyd.service")||masked("ntpd.service")||masked("systemd-timesyncd.service"))return -1;
 DIR*d=opendir("/proc");if(!d)return -1;struct dirent*entry;unsigned count=0;int result=0;
 while((entry=readdir(d))){if(entry->d_name[0]<'0'||entry->d_name[0]>'9')continue;if(++count>32768){result=-1;break;}
 char path[300],comm[128];int n=snprintf(path,sizeof path,"/proc/%s/comm",entry->d_name);if(n<1||(size_t)n>=sizeof path){result=-1;break;}
 if(read_scalar(path,comm,sizeof comm)){if(errno==ENOENT)continue;result=-1;break;}
 if(!strcmp(comm,"chronyd")||!strcmp(comm,"ntpd")||!strcmp(comm,"systemd-timesyn")){result=-1;break;}}
 if(closedir(d))result=-1;return result;
}
static int alive(int pidfd){struct pollfd p={pidfd,POLLIN,0};return poll(&p,1,0)==0;}
static int same_boot_suspend(const char*boot,const char*suspend){char a[129],b[64];return read_scalar("/proc/sys/kernel/random/boot_id",a,sizeof a)||read_scalar("/sys/power/suspend_stats/success",b,sizeof b)||strcmp(a,boot)||strcmp(b,suspend)?-1:0;}
/* Compare held capture against its original metadata, not merely the current
 * held/named pair. Changes during nonce/capture must refuse before launch. */
static int captured_directory_current(int directory,const struct stat*original){
 struct stat s;return fstat(directory,&s)||s.st_dev!=original->st_dev||s.st_ino!=original->st_ino||s.st_mode!=original->st_mode||s.st_uid!=original->st_uid||s.st_gid!=original->st_gid||s.st_ctim.tv_sec!=original->st_ctim.tv_sec||s.st_ctim.tv_nsec!=original->st_ctim.tv_nsec||s.st_mtim.tv_sec!=original->st_mtim.tv_sec||s.st_mtim.tv_nsec!=original->st_mtim.tv_nsec||unchanged(directory_path,directory)||!no_acl(directory)?-1:0;
}
static int all_current(int daemon_pidfd,int policy,int daemon,int node,int directory,const char*boot,const char*suspend,const struct axiom_operational_acceptance*a){
 struct stat s;return withdrawing||frozen_current()||!alive(daemon_pidfd)||services_stopped()||same_boot_suspend(boot,suspend)||unchanged(policy_path,policy)||unchanged(daemon_path,daemon)||unchanged(node_path,node)||unchanged(directory_path,directory)||fstat(directory,&s)||s.st_dev!=a->directory_device||s.st_ino!=a->directory_inode||s.st_uid!=0||(s.st_mode&07777)!=0750||s.st_gid!=a->reader_gid||!no_acl(directory)?-1:0;
}
static int remap(int from,int to){return from==to?fcntl(to,F_SETFD,0):dup3(from,to,0);}
static void stop_owned(int pidfd,pid_t pid){
 if(pidfd<0||pid<=0)return;
 if(syscall(SYS_pidfd_send_signal,pidfd,SIGKILL,NULL,0)<0&&errno!=ESRCH)return;
 uint64_t start,now;if(axiom_operational_monotonic(&start))return;
 do {siginfo_t info={0};if(waitid(P_PIDFD,(id_t)pidfd,&info,WEXITED|WNOHANG))return;if(info.si_pid)return;struct timespec sleep={0,1000000};nanosleep(&sleep,NULL);}while(!axiom_operational_monotonic(&now)&&now-start<100000000);
 /* No cleanup success receipt on uncertain reap. External owner must inspect. */
}
static int duplicate(int fd){return fcntl(fd,F_DUPFD_CLOEXEC,32);}
int main(int argc,char**argv){
 (void)argv;if(argc!=1||getuid()!=0||geteuid()!=0||getgid()!=0)return 70;
 struct sigaction action={0};action.sa_handler=withdraw;sigemptyset(&action.sa_mask);if(sigaction(SIGTERM,&action,NULL)||sigaction(SIGINT,&action,NULL)||sigaction(SIGHUP,&action,NULL))return 70;
 int policy=-1,daemon=-1,node=-1,directory=-1,accepted=-1,dpidfd=-1,npidfd=-1;pid_t dpid=-1,npid=-1;int result=70;
 int request[2]={-1,-1},reply[2]={-1,-1},updates[2]={-1,-1},ack[2]={-1,-1};
 if(protected_ancestors(directory_path))goto done;
 for(size_t i=0;i<sizeof frozen/sizeof frozen[0];i++){frozen[i].fd=protected_file(frozen[i].path,&frozen[i].original);if(frozen[i].fd<0||hash_fd(frozen[i].fd,frozen[i].digest))goto done;}
 /* Policy is read from the SAME original FD whose digest was checked above.
  * New packages bind that immutable semantic policy, never a host-late profile. */
 policy=frozen[0].fd;if(frozen[0].original.st_size<1||frozen[0].original.st_size>4096)goto done;daemon=protected_file(daemon_path,NULL);node=protected_file(node_path,NULL);directory=open(directory_path,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
 unsigned char bytes[4097];struct axiom_operational_acceptance a;struct axiom_operational_policy semantic;ssize_t n=policy>=0?pread(policy,bytes,sizeof bytes,0):-1;
 if(n<1||n>4096||n!=frozen[0].original.st_size||axiom_operational_policy_decode(bytes,(size_t)n,&semantic)||daemon<0||node<0||directory<0)goto done;
 uid_fd=protected_file("/etc/axiom-operational-time/reader-uid",&uid_stat);if(uid_fd<0)goto done;
 char boot[129],suspend[64],uid_text[32];if(read_scalar("/proc/sys/kernel/random/boot_id",boot,sizeof boot)||read_scalar("/sys/power/suspend_stats/success",suspend,sizeof suspend)||read_scalar("/etc/axiom-operational-time/reader-uid",uid_text,sizeof uid_text)||services_stopped())goto done;
 uint64_t uid=0;for(size_t i=0;uid_text[i];i++){if(uid_text[i]<'0'||uid_text[i]>'9'||uid>(UINT32_MAX-(unsigned)(uid_text[i]-'0'))/10)goto done;uid=uid*10+(unsigned)(uid_text[i]-'0');}if(uid!=semantic.reader_uid)goto done;
 int uid_length=snprintf(accepted_uid,sizeof accepted_uid,"%llu",(unsigned long long)semantic.reader_uid);if(uid_length<1||(size_t)uid_length>=sizeof accepted_uid||strcmp(uid_text,accepted_uid))goto done;
 struct stat ds;if(fstat(directory,&ds)||ds.st_uid!=0||ds.st_gid!=semantic.reader_gid||(ds.st_mode&07777)!=0750||!no_acl(directory)||frozen_current()||unchanged(directory_path,directory)||same_boot_suspend(boot,suspend)||withdrawing)goto done;
 /* One nonblocking call, no retry on EINTR/EAGAIN/short/error/zero entropy.
  * The volatile accepted marker is NOT durable cross-boot attempt consumption. */
 unsigned char nonce[32];if(getrandom(nonce,sizeof nonce,GRND_NONBLOCK)!=(ssize_t)sizeof nonce)goto done;
 if(axiom_operational_accept_derive(&semantic,AXIOM_OPERATIONAL_PROFILE_SHA256,boot,(uint64_t)ds.st_dev,(uint64_t)ds.st_ino,nonce,sizeof nonce,&a)||frozen_current()||captured_directory_current(directory,&ds)||unchanged(directory_path,directory)||same_boot_suspend(boot,suspend)||services_stopped()||withdrawing)goto done;
 size_t accept_length;if(axiom_operational_accept_encode(&a,bytes,&accept_length))goto done;
 accepted=open("/run/axiom-operational-time/accepted",O_RDWR|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);if(accepted<0)goto done;
 if(write(accepted,bytes,accept_length)!=(ssize_t)accept_length||fsync(accepted)||fchmod(accepted,0440)||close(accepted))goto done;accepted=-1;
 accepted=open("/run/axiom-operational-time/accepted",O_RDONLY|O_NOFOLLOW|O_CLOEXEC);if(accepted<0||pipe2(request,O_CLOEXEC|O_NONBLOCK)||pipe2(reply,O_CLOEXEC|O_NONBLOCK)||pipe2(updates,O_CLOEXEC|O_NONBLOCK)||pipe2(ack,O_CLOEXEC|O_NONBLOCK))goto done;
 int directory_copy=duplicate(directory),accept_copy=duplicate(accepted),update_copy=duplicate(updates[1]),ack_copy=duplicate(ack[0]),daemon_copy=duplicate(daemon);
 if(directory_copy<0||accept_copy<0||update_copy<0||ack_copy<0||daemon_copy<0)goto done;
 dpid=fork();if(dpid<0)goto done;if(!dpid){if(remap(directory_copy,3)<0||remap(accept_copy,8)<0||remap(update_copy,11)<0||remap(ack_copy,12)<0||remap(daemon_copy,7)<0||syscall(SYS_close_range,13u,UINT_MAX,0u)<0)_exit(70);for(int fd=4;fd<=10;fd++)if(fd!=7&&fd!=8)close(fd);char*const av[]={"axiom-operational-daemon",NULL};char*const env[]={NULL};fexecve(7,av,env);_exit(70);}
 close(directory_copy);close(accept_copy);close(update_copy);close(ack_copy);close(daemon_copy);close(updates[1]);updates[1]=-1;close(ack[0]);ack[0]=-1;
 dpidfd=(int)syscall(SYS_pidfd_open,dpid,0);if(dpidfd<0)goto done;
 /* Startup is not acceptance from a cached flag: receive and ACK actual
  * Unknown->Ready hook transitions before the consumer can request time. */
 struct axiom_operational_status actual={0};uint64_t startup;
 if(axiom_operational_monotonic(&startup)||startup>UINT64_MAX-30000000000ULL)goto done;
 const uint64_t startup_deadline=startup+30000000000ULL;
 while(actual.state!=AXIOM_OP_READY){
  uint64_t now;if(axiom_operational_monotonic(&now)||now>=startup_deadline||all_current(dpidfd,policy,daemon,node,directory,boot,suspend,&a))goto done;
  struct pollfd update={updates[0],POLLIN,0};int ready=poll(&update,1,20);if(ready<0){if(errno==EINTR)continue;goto done;}if(!ready)continue;
  uint64_t deadline=now+500000000;if(deadline>startup_deadline)deadline=startup_deadline;
  size_t length;struct axiom_operational_status event;
  if(axiom_operational_read_frame(updates[0],bytes,&length,deadline)||axiom_operational_status_decode(bytes,length,&event)||event.sequence||event.revision!=a.revision||strcmp(event.profile,a.profile)||strcmp(event.host,a.host)||strcmp(event.source_generation,a.source_generation)||event.publication<=actual.publication||event.transition!=actual.transition+1||(!actual.publication&&event.state!=AXIOM_OP_UNKNOWN)||event.marker<actual.marker||all_current(dpidfd,policy,daemon,node,directory,boot,suspend,&a))goto done;
  actual=event;if(axiom_operational_status_encode(&actual,bytes,&length)||axiom_operational_write_frame(ack[1],bytes,length,deadline))goto done;
 }
 /* The production consumer is an immutable fixed reviewed package. Its actual
  * initializer calls the private C bootstrap; no CLI/config selects assurance. */
 int check_copy=duplicate(request[1]),reply_copy=duplicate(reply[0]),accept_node=duplicate(accepted),node_copy=duplicate(node),node_directory=duplicate(directory),node_worker=duplicate(frozen[3].fd);
 if(check_copy<0||reply_copy<0||accept_node<0||node_copy<0||node_directory<0||node_worker<0)goto done;
 npid=fork();if(npid<0)goto done;if(!npid){
  if(remap(node_directory,3)<0||remap(node_worker,4)<0||remap(accept_node,8)<0||remap(check_copy,9)<0||remap(reply_copy,10)<0||remap(node_copy,7)<0||syscall(SYS_close_range,11u,UINT_MAX,0u)<0)_exit(70);
  for(int fd=5;fd<=6;fd++)close(fd);
  if(prctl(PR_SET_KEEPCAPS,0,0,0,0)||prctl(PR_CAP_AMBIENT,PR_CAP_AMBIENT_CLEAR_ALL,0,0,0))_exit(70);
  if(setgroups(0,NULL)||setresgid((gid_t)a.reader_gid,(gid_t)a.reader_gid,(gid_t)a.reader_gid)||setresuid((uid_t)uid,(uid_t)uid,(uid_t)uid))_exit(70);
  uid_t ruid,euid,suid;gid_t rgid,egid,sgid;
  if(getresuid(&ruid,&euid,&suid)||getresgid(&rgid,&egid,&sgid)||ruid!=(uid_t)uid||euid!=(uid_t)uid||suid!=(uid_t)uid||rgid!=(gid_t)a.reader_gid||egid!=(gid_t)a.reader_gid||sgid!=(gid_t)a.reader_gid||prctl(PR_SET_NO_NEW_PRIVS,1,0,0,0))_exit(70);
  struct sock_fprog program={(unsigned short)(sizeof runtime_filter/sizeof runtime_filter[0]),runtime_filter};if(prctl(PR_SET_SECCOMP,SECCOMP_MODE_FILTER,&program))_exit(70);
  char*const av[]={"node","/opt/axiom-operational-time/private/main.mjs",NULL};char*const env[]={"PATH=/usr/bin:/bin",NULL};fexecve(7,av,env);_exit(70);
 }
 close(check_copy);close(reply_copy);close(accept_node);close(node_copy);close(node_directory);close(node_worker);close(request[1]);request[1]=-1;close(reply[0]);reply[0]=-1;
 npidfd=(int)syscall(SYS_pidfd_open,npid,0);if(npidfd<0)goto done;
 uint64_t sequence=0;
 while(!withdrawing&&alive(npidfd)){
  if(all_current(dpidfd,policy,daemon,node,directory,boot,suspend,&a))break;
  struct pollfd fds[2]={{updates[0],POLLIN,0},{request[0],POLLIN,0}};int ready=poll(fds,2,20);if(ready<0){if(errno==EINTR)continue;break;}if(!ready)continue;
  uint64_t now;if(axiom_operational_monotonic(&now))break;uint64_t deadline=now+500000000;size_t length;
  if(fds[0].revents){struct axiom_operational_status event;if(axiom_operational_read_frame(updates[0],bytes,&length,deadline)||axiom_operational_status_decode(bytes,length,&event)||event.sequence||event.revision!=a.revision||strcmp(event.profile,a.profile)||strcmp(event.host,a.host)||strcmp(event.source_generation,a.source_generation)||event.publication<=actual.publication||event.transition!=actual.transition+1||(!actual.publication&&event.state!=AXIOM_OP_UNKNOWN)||event.marker<actual.marker||all_current(dpidfd,policy,daemon,node,directory,boot,suspend,&a))break;actual=event;
   /* Startup Unknown->Ready was accepted above. After first Ready, any
    * invalidation permanently withdraws this original accepted generation.
    * ACK the actual invalidation boundedly so it cannot be mistaken for Ready,
    * then stop owned processes; never accept a later Ready as reauthorization. */
   int retire_generation=event.state!=AXIOM_OP_READY;
   if(retire_generation)withdrawing=1;
   if(axiom_operational_status_encode(&actual,bytes,&length)||axiom_operational_write_frame(ack[1],bytes,length,deadline))break;
   if(retire_generation)break;
  }
  if(fds[1].revents){struct axiom_operational_status q,answer;if(axiom_operational_read_frame(request[0],bytes,&length,deadline)||axiom_operational_check_decode(bytes,length,&q)||sequence==UINT64_MAX||q.sequence!=sequence+1||q.revision!=actual.revision||q.publication!=actual.publication||q.marker!=actual.marker||strcmp(q.profile,actual.profile)||strcmp(q.host,actual.host)||strcmp(q.source_generation,actual.source_generation)||actual.state!=AXIOM_OP_READY||all_current(dpidfd,policy,daemon,node,directory,boot,suspend,&a))break;sequence=q.sequence;answer=actual;answer.sequence=sequence;if(axiom_operational_status_encode(&answer,bytes,&length)||axiom_operational_write_frame(reply[1],bytes,length,deadline))break;}
 }
 done:withdrawing=1;stop_owned(npidfd,npid);stop_owned(dpidfd,dpid);if(npidfd>=0)close(npidfd);if(dpidfd>=0)close(dpidfd);for(size_t i=0;i<sizeof frozen/sizeof frozen[0];i++)if(frozen[i].fd>=0)close(frozen[i].fd);if(uid_fd>=0)close(uid_fd);int all[]={daemon,node,directory,accepted,request[0],request[1],reply[0],reply[1],updates[0],updates[1],ack[0],ack[1]};for(size_t i=0;i<sizeof all/sizeof all[0];i++)if(all[i]>=0)close(all[i]);return result;
}
