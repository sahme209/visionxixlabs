#define _DARWIN_C_SOURCE 1
#include "synthetic_fixture_producer.h"
#include "synthetic_fixture_frame.h"
#include "synthetic_fixture_readiness.h"
#include "fixture_authorization_frame.h"
#include "fixture_controller_handoff.h"
#include "owner_config.h"
#include "origin_root_binding.h"
#include "origin_config.h"
#include <spawn.h>
#include <CommonCrypto/CommonDigest.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <sys/resource.h>
#include <fcntl.h>
#include <poll.h>
#include <signal.h>
#include <unistd.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <errno.h>
#include <time.h>
#ifndef AX_FIXTURE_NODE_SHA256
#define AX_FIXTURE_NODE_SHA256 ""
#endif
#ifndef AX_FIXTURE_PRODUCER_SHA256
#define AX_FIXTURE_PRODUCER_SHA256 ""
#endif
#define FIXTURE_NODE AX_SYNTH_ROOT "/fixture-tools/node"
#define PRODUCER AX_SYNTH_APP "/Contents/Resources/qualification/fixture-producer.cjs"
#define HBA AX_SYNTH_ROOT "/fixture/pg_hba.conf"
static atomic_flag once=ATOMIC_FLAG_INIT;
static AxFixtureAuthorizationStream authorization;
static AxFixtureAuthorization parsed_authorization;
static uint64_t authorization_deadline;
static int authorization_valid,authorization_provisioned,authorization_consumed;
static uint64_t now_ms(void){struct timespec t;if(clock_gettime(CLOCK_MONOTONIC,&t))return UINT64_MAX;return(uint64_t)t.tv_sec*1000+(uint64_t)t.tv_nsec/1000000;}
static int shared_backing_protected(void){return !strcmp(AXIOM_ISSUER_CONTROL_APP,AX_SYNTH_APP)&&ax_fixture_protected_file(AXIOM_ISSUER_IMAGE_BACKING,0)&&ax_fixture_protected_file(AX_SYNTH_APP "/Contents/Resources/issuer-binding.plist",0);}
static int recipe_files_current(void){const char*files[]={AX_SYNTH_APP "/Contents/Resources/qualification/fixture-schema.binding.json",AX_SYNTH_APP "/Contents/Resources/qualification/fixture-schema.sql",AX_SYNTH_APP "/Contents/Resources/qualification/fixture-seed.sql"};for(unsigned i=0;i<sizeof files/sizeof files[0];i++)if(!ax_fixture_protected_file(files[i],0))return 0;return 1;}
static int file_hash(const char*path,const char*expected){if(strlen(expected)!=64||!ax_fixture_protected_file(path,0))return 0;int fd=open(path,O_RDONLY|O_NOFOLLOW|O_CLOEXEC);if(fd<0)return 0;struct stat before,after;CC_SHA256_CTX hash;unsigned char data[8192],digest[32]={0};char hex[65]={0};int ok=!fstat(fd,&before)&&CC_SHA256_Init(&hash);while(ok){ssize_t n=read(fd,data,sizeof data);if(n<0&&errno==EINTR)continue;if(n<0){ok=0;break;}if(!n)break;if(!CC_SHA256_Update(&hash,data,(CC_LONG)n)){ok=0;break;}}ok=ok&&!fstat(fd,&after)&&before.st_dev==after.st_dev&&before.st_ino==after.st_ino&&before.st_size==after.st_size&&before.st_mtimespec.tv_sec==after.st_mtimespec.tv_sec&&before.st_mtimespec.tv_nsec==after.st_mtimespec.tv_nsec&&CC_SHA256_Final(digest,&hash);if(close(fd))ok=0;for(unsigned i=0;i<32;i++)snprintf(hex+2*i,3,"%02x",digest[i]);return ok&&!strcmp(hex,expected);}
static int io_all(int fd,unsigned char*data,size_t n,int writing,uint64_t deadline){while(n){uint64_t at=now_ms();if(at==UINT64_MAX||at>=deadline)return 0;struct pollfd p={fd,writing?POLLOUT:POLLIN,0};int ready=poll(&p,1,(int)(deadline-at));if(ready<0&&errno==EINTR)continue;if(ready<=0||p.revents&(POLLERR|POLLNVAL))return 0;ssize_t got=writing?write(fd,data,n):read(fd,data,n);if(got<0&&errno==EINTR)continue;if(got<=0)return 0;data+=got;n-=(size_t)got;}return 1;}
static int final_hba(void){static const char text[]="local axiom_issuer_qualification axiom_fixture_admin peer map=axiom_fixture_root\nlocal axiom_issuer_qualification axiom_fixture_runtime scram-sha-256\nlocal all all reject\nhost all all 0.0.0.0/0 reject\nhost all all ::0/0 reject\n";if(!ax_fixture_protected_file(HBA,0))return 0;int fd=open(HBA ".final-staging",O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);if(fd<0)return 0;size_t used=0;int ok=1;while(used<sizeof text-1){ssize_t n=write(fd,text+used,sizeof text-1-used);if(n<0&&errno==EINTR)continue;if(n<=0){ok=0;break;}used+=(size_t)n;}if(fchmod(fd,0644)||fcntl(fd,F_FULLFSYNC,0)||close(fd))ok=0;if(!ok||rename(HBA ".final-staging",HBA))return 0;int parent=open(AX_SYNTH_ROOT "/fixture",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);if(parent<0)return 0;ok=fcntl(parent,F_FULLFSYNC,0)==0;if(close(parent))ok=0;return ok&&ax_fixture_protected_file(HBA,0);}
static int record_phase(unsigned phase_value){if(!ax_fixture_protected_file(AX_SYNTH_ROOT "/fixture-producer.v1",0))return 0;int fd=open(AX_SYNTH_ROOT "/fixture-producer.v1",O_WRONLY|O_APPEND|O_NOFOLLOW|O_CLOEXEC);if(fd<0)return 0;unsigned char record[8]={'A','X','F','J',0,0,0,(unsigned char)phase_value};int ok=write(fd,record,sizeof record)==sizeof record&&fcntl(fd,F_FULLFSYNC,0)==0;if(close(fd))ok=0;return ok;}
static int spawn_fixed(int input[2],int output[2],int auth[2],pid_t*child){
 posix_spawn_file_actions_t actions;posix_spawnattr_t attributes;int have_actions=0,have_attributes=0,ok=0;sigset_t defaults,mask;
 if(posix_spawn_file_actions_init(&actions))goto done;have_actions=1;
 if(posix_spawnattr_init(&attributes))goto done;have_attributes=1;
 sigemptyset(&defaults);sigaddset(&defaults,SIGPIPE);sigaddset(&defaults,SIGCHLD);sigemptyset(&mask);
 if(posix_spawnattr_setflags(&attributes,POSIX_SPAWN_CLOEXEC_DEFAULT|POSIX_SPAWN_SETSIGDEF|POSIX_SPAWN_SETSIGMASK)||posix_spawnattr_setsigdefault(&attributes,&defaults)||posix_spawnattr_setsigmask(&attributes,&mask))goto done;
 if(posix_spawn_file_actions_adddup2(&actions,input[0],0)||posix_spawn_file_actions_adddup2(&actions,output[1],1)||posix_spawn_file_actions_addopen(&actions,2,"/dev/null",O_WRONLY,0)||posix_spawn_file_actions_addclose(&actions,input[0])||posix_spawn_file_actions_addclose(&actions,input[1])||posix_spawn_file_actions_addclose(&actions,output[0])||posix_spawn_file_actions_addclose(&actions,output[1])||posix_spawn_file_actions_addclose(&actions,auth[0])||posix_spawn_file_actions_adddup2(&actions,auth[1],3)||posix_spawn_file_actions_addclose(&actions,auth[1])||posix_spawn_file_actions_addchdir_np(&actions,AX_SYNTH_ROOT))goto done;
 {char*const argv[]={FIXTURE_NODE,PRODUCER,NULL};char*const env[]={"NODE_ENV=production","LANG=C","TZ=UTC",NULL};pid_t owned=-1;int result=posix_spawn(&owned,FIXTURE_NODE,&actions,&attributes,argv,env);if(result==0&&owned>0){*child=owned;ok=1;}}
 done:if(have_attributes)posix_spawnattr_destroy(&attributes);if(have_actions)posix_spawn_file_actions_destroy(&actions);return ok;
}
static int collect_streams(int output,int auth,int input,uint64_t deadline){
 const unsigned steps[]={9,10,11,12,13,14,1,2};unsigned char phase_bytes[8];size_t used=0,index=0;int phase_eof=0,auth_eof=0;
 while(!phase_eof||!auth_eof){uint64_t at=now_ms();if(at==UINT64_MAX||at>=deadline)return 0;struct pollfd fds[2]={{phase_eof?-1:output,POLLIN,0},{auth_eof?-1:auth,POLLIN,0}};int result=poll(fds,2,(int)(deadline-at));if(result<0&&errno==EINTR)continue;if(result<=0)return 0;
  for(unsigned which=0;which<2;which++){if(fds[which].fd<0)continue;if(fds[which].revents&(POLLERR|POLLNVAL))return 0;if(!(fds[which].revents&(POLLIN|POLLHUP)))continue;unsigned char buffer[4096];ssize_t count=read(fds[which].fd,buffer,sizeof buffer);if(count<0&&errno==EINTR)continue;if(count<0)return 0;if(!count){if(which==0){if(used||index!=8)return 0;phase_eof=1;}else{if(!ax_fixture_authorization_stream_end(&authorization,&parsed_authorization))return 0;auth_eof=1;}continue;}
   if(which==1){if(!ax_fixture_authorization_stream_feed(&authorization,buffer,(size_t)count))return 0;continue;}
   for(ssize_t i=0;i<count;i++){if(index>=8)return 0;phase_bytes[used++]=buffer[i];if(used==8){unsigned char expected[8]={'A','X','F','S',0,0,0,(unsigned char)steps[index]};if(memcmp(phase_bytes,expected,8)||!record_phase(steps[index]))return 0;if(steps[index]==1){if(!ax_fixture_maintenance_current()||!final_hba()||!record_phase(20))return 0;unsigned char ack[8]={'A','X','F','A',0,0,0,1};if(!io_all(input,ack,sizeof ack,1,deadline))return 0;}used=0;index++;}}
  }
 }return 1;
}
void ax_fixture_discard_authorization(void){authorization_valid=0;authorization_provisioned=0;ax_fixture_authorization_stream_wipe(&authorization);ax_fixture_authorization_wipe(&parsed_authorization);}
int ax_fixture_authorization_locators_published(void){if(!authorization_valid||authorization_provisioned||authorization_consumed||!ax_fixture_maintenance_current()||!record_phase(41))return 0;authorization_provisioned=1;return 1;}
int ax_fixture_commit_and_run_controller(void){if(!authorization_valid||!authorization_provisioned||authorization_consumed||!ax_fixture_maintenance_current())return 0;authorization_consumed=1;int ok=record_phase(40)&&ax_fixture_controller_handoff(authorization.bytes,authorization.used,authorization_deadline);ax_fixture_discard_authorization();return ok;}
int ax_fixture_prepare_once(AxiomPrivateMaterial*out){if(!out)return 0;memset(out,0,sizeof *out);if(atomic_flag_test_and_set(&once)||AX_FIXTURE_CONTROLLER_UID<=0||AX_FIXTURE_CONTROLLER_GID<=0||AX_FIXTURE_CONTROLLER_UID==AX_FIXTURE_FIXED_UID||!ax_fixture_maintenance_current()||!file_hash(FIXTURE_NODE,AX_FIXTURE_NODE_SHA256)||!file_hash(PRODUCER,AX_FIXTURE_PRODUCER_SHA256)||!recipe_files_current())return 0;AxiomOriginRootBinding root;if(!shared_backing_protected()||!axiom_origin_bind_root(&root)||!axiom_origin_root_current(&root))return 0;for(int fd=0;fd<3;fd++)if(fcntl(fd,F_GETFD)<0)return 0;struct sigaction child_signal;if(sigaction(SIGCHLD,NULL,&child_signal)||child_signal.sa_handler!=SIG_DFL||(child_signal.sa_flags&SA_NOCLDWAIT))return 0;AxSyntheticFixtureFrame material={0};unsigned char frame[AX_FIXTURE_FRAME_SIZE];int to_child[2]={-1,-1},from_child[2]={-1,-1},auth_child[2]={-1,-1};pid_t child=-1;int ok=0,journal_owned=0;uint64_t deadline=now_ms();if(deadline==UINT64_MAX||deadline>UINT64_MAX-60000)return 0;deadline+=60000;authorization_deadline=deadline;
 int journal=open(AX_SYNTH_ROOT "/fixture-producer.v1",O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);if(journal<0)goto finish;journal_owned=1;unsigned char intent[8]={'A','X','F','J',0,0,0,1};int durable=write(journal,intent,sizeof intent)==sizeof intent&&fcntl(journal,F_FULLFSYNC,0)==0;if(close(journal))durable=0;int directory=open(AX_SYNTH_ROOT,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);if(directory<0)durable=0;else{if(fcntl(directory,F_FULLFSYNC,0))durable=0;close(directory);}if(!durable)goto finish;struct sigaction ignored;memset(&ignored,0,sizeof ignored);ignored.sa_handler=SIG_IGN;sigemptyset(&ignored.sa_mask);if(sigaction(SIGPIPE,&ignored,NULL))goto finish;
 arc4random_buf(material.password,32);arc4random_buf(material.vault,32);arc4random_buf(material.session,32);if(!ax_fixture_frame_encode(&material,frame,sizeof frame)||pipe(to_child)||pipe(from_child)||pipe(auth_child))goto finish;
 if(!shared_backing_protected()||!axiom_origin_root_current(&root)||!spawn_fixed(to_child,from_child,auth_child,&child))goto finish;
 close(to_child[0]);to_child[0]=-1;close(from_child[1]);from_child[1]=-1;close(auth_child[1]);auth_child[1]=-1;
 if(!shared_backing_protected()||!axiom_origin_root_current(&root)||!io_all(to_child[1],frame,sizeof frame,1,deadline))goto finish;
 if(!collect_streams(from_child[0],auth_child[0],to_child[1],deadline))goto finish;
 {int status=0;for(;;){pid_t result=waitpid(child,&status,WNOHANG);if(result==child){child=-1;ok=WIFEXITED(status)&&WEXITSTATUS(status)==0;break;}if(result<0&&errno!=EINTR){child=-1;break;}if(now_ms()>=deadline)break;struct timespec pause={0,1000000};nanosleep(&pause,NULL);}}
 if(ok)authorization_valid=1;
 if(ok&&file_hash(FIXTURE_NODE,AX_FIXTURE_NODE_SHA256)&&file_hash(PRODUCER,AX_FIXTURE_PRODUCER_SHA256)&&recipe_files_current()&&shared_backing_protected()&&ax_fixture_maintenance_current()&&axiom_origin_root_current(&root)){char password[65],socket[4096];for(unsigned i=0;i<32;i++)snprintf(password+2*i,3,"%02x",material.password[i]);const unsigned char*raw=(const unsigned char*)AX_SYNTH_ROOT "/fixture/socket";size_t used=0;for(;*raw;raw++){if(used+4>=sizeof socket){ok=0;break;}if((*raw>='a'&&*raw<='z')||(*raw>='A'&&*raw<='Z')||(*raw>='0'&&*raw<='9')||strchr("-_.~",*raw))socket[used++]=(char)*raw;else{snprintf(socket+used,4,"%%%02X",*raw);used+=3;}}socket[used]=0;if(ok){int n=snprintf((char*)out->datasource,sizeof out->datasource,"postgresql://axiom_fixture_runtime:%s@localhost/axiom_issuer_qualification?host=%s",password,socket);ok=n>0&&(size_t)n<sizeof out->datasource;if(ok){out->datasource_length=(size_t)n;memcpy(out->vault,material.vault,32);memcpy(out->session,material.session,32);out->session_length=32;}}volatile char*p=password;for(unsigned i=0;i<sizeof password;i++)p[i]=0;}else ok=0;
 finish:if(journal_owned&&!record_phase(ok?30:255))ok=0;if(child>0){int status=0;pid_t observed=waitpid(child,&status,WNOHANG);if(observed==0){kill(child,SIGKILL);uint64_t stop=now_ms()+2000;for(;;){pid_t reaped=waitpid(child,&status,WNOHANG);if(reaped==child){child=-1;break;}if(reaped<0&&errno!=EINTR){child=-1;break;}if(now_ms()>=stop)break;struct timespec pause={0,1000000};nanosleep(&pause,NULL);}}else child=-1;}for(unsigned i=0;i<2;i++){if(to_child[i]>=0)close(to_child[i]);if(from_child[i]>=0)close(from_child[i]);if(auth_child[i]>=0)close(auth_child[i]);}ax_fixture_frame_wipe(&material);volatile unsigned char*p=frame;for(unsigned i=0;i<sizeof frame;i++)p[i]=0;if(!ok){memset(out,0,sizeof *out);ax_fixture_discard_authorization();}return ok;
}
