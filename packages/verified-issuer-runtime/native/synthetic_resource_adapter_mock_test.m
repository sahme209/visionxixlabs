/* Mocked Security calls ONLY. No actual Keychain API may be imported. */
#define SecItemAdd ax_mock_SecItemAdd
#define SecKeychainSetUserInteractionAllowed ax_mock_UI
#define SecKeychainOpen ax_mock_Open
#define SecAccessGetOwnerAndACL ax_mock_Export
#define openat ax_mock_openat
#define fchown ax_mock_fchown
#define fchmod ax_mock_fchmod
#define fstat ax_mock_fstat
#define acl_get_fd_np ax_mock_acl_get_fd_np
#define acl_init ax_mock_acl_init
#define acl_size ax_mock_acl_size
#define acl_copy_ext ax_mock_acl_copy_ext
#define acl_free ax_mock_acl_free
#define write ax_mock_write
#define fcntl ax_mock_fcntl
#define ax_fixture_authorization_locators_published ax_mock_authorization_locators_published
#define close ax_mock_close
#define renameatx_np ax_mock_rename
#include "synthetic_resource_provisioner.m"
#include <assert.h>
static char events[100];static size_t nevents;static int fs_mode,publication_refused;
static void event(char c){assert(nevents+1<sizeof events);events[nevents++]=c;events[nevents]=0;}
int ax_mock_openat(int fd,const char*name,int flags,...){assert(fd==5);assert(!strcmp(name,"bootstrap-locators.v1.staging"));assert((flags&(O_EXCL|O_NOFOLLOW|O_CREAT))==(O_EXCL|O_NOFOLLOW|O_CREAT));event('O');return 7;}
int ax_mock_fchown(int f,uid_t u,gid_t g){assert(f==7&&u==0&&g==0);event('H');return 0;}
int ax_mock_fchmod(int f,mode_t m){assert(f==7&&m==0644);event('M');return 0;}
int ax_mock_fstat(int f,struct stat*s){assert(f==7);memset(s,0,sizeof *s);s->st_mode=S_IFREG|0644;s->st_nlink=1;event('T');return 0;}
acl_t ax_mock_acl_get_fd_np(int f,acl_type_t t){assert(f==7&&t==ACL_TYPE_EXTENDED);return (acl_t)(uintptr_t)1;}
acl_t ax_mock_acl_init(int n){assert(n==0);return (acl_t)(uintptr_t)2;}
ssize_t ax_mock_acl_size(acl_t a){assert((uintptr_t)a==1||(uintptr_t)a==2);return 8;}
ssize_t ax_mock_acl_copy_ext(void*p,acl_t a,ssize_t n){assert(((uintptr_t)a==1||(uintptr_t)a==2)&&n==8);memset(p,0,8);return 8;}
int ax_mock_acl_free(void*a){assert((uintptr_t)a==1||(uintptr_t)a==2);return 0;}
ssize_t ax_mock_write(int f,const void*p,size_t n){assert((f==7||f==6)&&p&&n>0);event('W');return (ssize_t)n;}
int ax_mock_fcntl(int f,int cmd,...){assert((f==5||f==6||f==7)&&cmd==F_FULLFSYNC);event('S');if(fs_mode==2&&f==7){errno=EIO;return -1;}return 0;}
/* Simulated publication notification only; no authorization state is created. */
int ax_mock_authorization_locators_published(void){assert(!strcmp(events,"OHMTWSCRS"));event('A');return !publication_refused;}
int ax_mock_close(int f){assert(f==7);event('C');return 0;}
int ax_mock_rename(int a,const char*x,int b,const char*y,unsigned flags){assert(a==5&&b==5&&!strcmp(x,"bootstrap-locators.v1.staging")&&!strcmp(y,"bootstrap-locators.v1")&&flags==RENAME_EXCL);event('R');if(fs_mode==1){errno=EEXIST;return -1;}return 0;}
static id expected_keychain,expected_access;
static unsigned calls;static int result_mode;
OSStatus ax_mock_SecItemAdd(CFDictionaryRef query,CFTypeRef *result){
 NSDictionary*q=(__bridge NSDictionary*)query;calls++;
 assert(q.count==7);
 assert([q[(__bridge id)kSecClass] isEqual:(__bridge id)kSecClassGenericPassword]);
 assert([q[(__bridge id)kSecAttrService] isEqual:@AX_SYNTH_SERVICE]);
 assert(q[(__bridge id)kSecUseKeychain]==expected_keychain);
 assert(q[(__bridge id)kSecAttrAccess]==expected_access);
 assert([q[(__bridge id)kSecReturnPersistentRef] isEqual:@YES]);
 assert([q[(__bridge id)kSecAttrAccount] isEqual:[NSString stringWithUTF8String:ax_synthetic_account(calls)]]);
 assert([q[(__bridge id)kSecValueData] length]==(calls==1?1:32));
 if(result_mode==1)return errSecDuplicateItem;
 if(result_mode==2)return errSecAuthFailed;
 if(result_mode==3){*result=CFRetain(CFSTR("wrong-type"));return errSecSuccess;}
 unsigned char bytes[AX_SYNTH_LOCATOR_MAX+1]={0x12};
 *result=CFDataCreate(NULL,bytes,result_mode==4?sizeof bytes:7);return errSecSuccess;
}
OSStatus ax_mock_UI(Boolean b){(void)b;assert(0);return errSecUnimplemented;}
OSStatus ax_mock_Open(const char*p,SecKeychainRef*r){(void)p;(void)r;assert(0);return errSecUnimplemented;}
OSStatus ax_mock_Export(SecAccessRef a,CSSM_ACL_OWNER_PROTOTYPE_PTR*o,uint32*c,CSSM_ACL_ENTRY_INFO_PTR*e){(void)a;(void)o;(void)c;(void)e;assert(0);return errSecUnimplemented;}
int ax_cssm_prepare_once(void){assert(0);return 0;}
SecAccessRef ax_cssm_prepared_access(void){assert(0);return NULL;}
const ax_cssm_policy*ax_cssm_prepared_policy(void){assert(0);return NULL;}
int ax_cssm_inspect_framework(const ax_cssm_policy*p,const CSSM_ACL_OWNER_PROTOTYPE*o,unsigned n,const CSSM_ACL_ENTRY_INFO*e){(void)p;(void)o;(void)n;(void)e;assert(0);return 0;}
int main(void){@autoreleasepool{
 expected_keychain=@"mock-keychain";expected_access=@"mock-access";
 unsigned char v[32]={1};AxSyntheticInstallerMaterial m={{v,v,v},{1,32,32}};
 Native n={.keychain=(__bridge SecKeychainRef)@"mock-keychain",.access=(__bridge SecAccessRef)@"mock-access",.material=&m};
 unsigned char locator[AX_SYNTH_LOCATOR_MAX];size_t length;
 for(unsigned role=1;role<=3;role++){length=0;assert(add(&n,role,locator,&length)==AX_SYNTH_ADD_OK);assert(length==7&&locator[0]==0x12);}
 assert(calls==3);
 for(int mode=1;mode<=4;mode++){result_mode=mode;calls=0;length=99;int r=add(&n,1,locator,&length);assert(calls==1);assert(r==(mode==1?AX_SYNTH_ADD_DUPLICATE:mode==2?AX_SYNTH_ADD_FAILED:AX_SYNTH_ADD_OK));if(mode>=3)assert(length==0);}
 calls=0;assert(add(&n,0,locator,&length)==AX_SYNTH_ADD_FAILED&&calls==0);
 Native io={.dir=5,.journal=6};unsigned char record[32]={0};
 nevents=0;assert(journal_write(&io,record));assert(!strcmp(events,"WSS"));
 AxSyntheticLocators loc={.length={1,1,1},.bytes={{1},{2},{3}}};
 nevents=0;assert(publish(&io,&loc)==AX_SYNTH_PUBLISH_OK);assert(!strcmp(events,"OHMTWSCRSA"));
 nevents=0;publication_refused=1;assert(publish(&io,&loc)==AX_SYNTH_PUBLISH_UNKNOWN);assert(!strcmp(events,"OHMTWSCRSA"));publication_refused=0;
 nevents=0;fs_mode=1;assert(publish(&io,&loc)==AX_SYNTH_PUBLISH_COLLISION);assert(!strcmp(events,"OHMTWSCR"));
 nevents=0;fs_mode=2;assert(publish(&io,&loc)==AX_SYNTH_PUBLISH_UNKNOWN);assert(!strcmp(events,"OHMTWSC"));
 puts("PASS actual journal/publish callbacks with renamed inert filesystem mocks");
 puts("PASS actual Add adapter shape/type/bounds/collision/refusal via renamed inert Security mock; no OS qualification");
}return 0;}
