/* Isolated closed-gate test: every Security function is renamed to an inert
 * aborting stub. Never invoke actual supplier OS paths or maintenance entry. */
#define SecKeychainSetUserInteractionAllowed mock_UI
#define SecKeychainItemGetTypeID mock_Type
#define SecKeychainItemCopyKeychain mock_Containing
#define SecKeychainItemCopyAttributesAndData mock_Attributes
#define SecKeychainItemFreeAttributesAndData mock_FreeAttributes
#define SecKeychainItemCopyAccess mock_Access
#define SecAccessCopyOwnerAndACL mock_Owner
#define SecAccessGetOwnerAndACL mock_Export
#define SecKeychainOpen mock_Open
#define SecItemCopyMatching mock_Match
#define SecKeychainItemCopyContent mock_Content
#define SecKeychainItemFreeContent mock_FreeContent
#include "origin_private_resource_supplier.m"
#include <assert.h>
#include <stdlib.h>
#define NEVER() abort()
OSStatus mock_UI(Boolean x){(void)x;NEVER();}
CFTypeID mock_Type(void){NEVER();}
OSStatus mock_Containing(SecKeychainItemRef x,SecKeychainRef*y){(void)x;(void)y;NEVER();}
OSStatus mock_Attributes(SecKeychainItemRef a,SecKeychainAttributeInfo*b,SecItemClass*c,SecKeychainAttributeList**d,UInt32*e,void**f){(void)a;(void)b;(void)c;(void)d;(void)e;(void)f;NEVER();}
OSStatus mock_FreeAttributes(SecKeychainAttributeList*a,void*b){(void)a;(void)b;NEVER();}
OSStatus mock_Access(SecKeychainItemRef a,SecAccessRef*b){(void)a;(void)b;NEVER();}
OSStatus mock_Owner(SecAccessRef a,uid_t*b,gid_t*c,SecAccessOwnerType*d,CFArrayRef*e){(void)a;(void)b;(void)c;(void)d;(void)e;NEVER();}
OSStatus mock_Export(SecAccessRef a,CSSM_ACL_OWNER_PROTOTYPE_PTR*b,uint32*c,CSSM_ACL_ENTRY_INFO_PTR*d){(void)a;(void)b;(void)c;(void)d;NEVER();}
OSStatus mock_Open(const char*a,SecKeychainRef*b){(void)a;(void)b;NEVER();}
OSStatus mock_Match(CFDictionaryRef a,CFTypeRef*b){(void)a;(void)b;NEVER();}
OSStatus mock_Content(SecKeychainItemRef a,SecItemClass*b,SecKeychainAttributeList*c,UInt32*d,void**e){(void)a;(void)b;(void)c;(void)d;(void)e;NEVER();}
OSStatus mock_FreeContent(SecKeychainAttributeList*a,void*b){(void)a;(void)b;NEVER();}
int ax_cssm_prepare_once(void){NEVER();}
const ax_cssm_policy*ax_cssm_prepared_policy(void){NEVER();}
int ax_cssm_inspect_framework(const ax_cssm_policy*a,const CSSM_ACL_OWNER_PROTOTYPE*b,unsigned c,const CSSM_ACL_ENTRY_INFO*d){(void)a;(void)b;(void)c;(void)d;NEVER();}
void axiom_private_material_wipe(AxiomPrivateMaterial*m){memset_s(m,sizeof *m,0,sizeof *m);}
int main(void){
 AxiomPrivateMaterial material;atomic_int cancelled=0;
 assert(axiom_private_supplier_operational()==0);
 assert(axiom_private_supplier_startup()==0);
 assert(axiom_private_supplier_startup()==0);
 memset(&material,0x7f,sizeof material);
 assert(axiom_private_supplier_read(&material,&cancelled,UINT64_MAX)==0);
 const unsigned char*p=(const unsigned char*)&material;for(size_t i=0;i<sizeof material;i++)assert(p[i]==0);
 atomic_store(&cancelled,1);assert(axiom_private_supplier_read(&material,&cancelled,0)==0);
 assert(!axiom_private_supplier_read(NULL,&cancelled,0));
 puts("PASS immutable gate/startup repetition/read/cancellation staging wipe with every Security function replaced by aborting mock");return 0;
}
