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
typedef struct {
 CSSM_ACL_OWNER_PROTOTYPE owner; CSSM_ACL_ENTRY_INFO entry;
 CSSM_LIST_ELEMENT n[18]; CSSM_ACL_PROCESS_SUBJECT_SELECTOR process;
 CSSM_ACL_KEYCHAIN_PROMPT_SELECTOR prompt;
 unsigned char hash[20],path[8],requirement[7],aux[3],description[3],date[2];
 CSSM_ACL_AUTHORIZATION_TAG rights[2];
} fixture;
static CSSM_LIST chain(fixture *f,unsigned start,unsigned count) {
 for(unsigned i=start;i<start+count;i++) f->n[i].NextElement=i+1<start+count?&f->n[i+1]:NULL;
 return (CSSM_LIST){CSSM_LIST_TYPE_UNKNOWN,&f->n[start],&f->n[start+count-1]};
}
static void word(fixture *f,unsigned i,CSSM_WORDID_TYPE v) { f->n[i].ElementType=CSSM_LIST_ELEMENT_WORDID; f->n[i].WordID=v; }
static void data(fixture *f,unsigned i,void *p,size_t n) { f->n[i].ElementType=CSSM_LIST_ELEMENT_DATUM; f->n[i].Element.Word=(CSSM_DATA){n,p}; }
static void init(fixture *f) {
 memset(f,0,sizeof *f); f->process=(CSSM_ACL_PROCESS_SUBJECT_SELECTOR){CSSM_ACL_PROCESS_SELECTOR_CURRENT_VERSION,CSSM_ACL_MATCH_UID,0,0};
 f->prompt.version=CSSM_ACL_KEYCHAIN_PROMPT_CURRENT_VERSION;
 word(f,0,CSSM_ACL_SUBJECT_TYPE_PROCESS); data(f,1,&f->process,sizeof f->process); f->owner.TypedSubject=chain(f,0,2);
 word(f,2,CSSM_ACL_SUBJECT_TYPE_THRESHOLD); word(f,3,1); word(f,4,2);
 f->n[5].ElementType=f->n[6].ElementType=CSSM_LIST_ELEMENT_SUBLIST;
 f->entry.EntryPublicInfo.TypedSubject=chain(f,2,5);
 word(f,7,CSSM_ACL_SUBJECT_TYPE_CODE_SIGNATURE); word(f,8,CSSM_ACL_CODE_SIGNATURE_OSX);
 memset(f->hash,0x34,sizeof f->hash); memcpy(f->path,"/fixed",7);
 memset(f->requirement,0xa9,sizeof f->requirement); memset(f->aux,0x75,sizeof f->aux);
 data(f,9,f->hash,sizeof f->hash); data(f,10,f->path,sizeof f->path);
 data(f,11,f->requirement,sizeof f->requirement); data(f,12,f->aux,sizeof f->aux);
 f->n[5].Element.Sublist=chain(f,7,6);
 word(f,13,CSSM_ACL_SUBJECT_TYPE_KEYCHAIN_PROMPT); data(f,14,&f->prompt,sizeof f->prompt); data(f,15,f->description,sizeof f->description);
 f->n[6].Element.Sublist=chain(f,13,3);
 f->rights[0]=CSSM_ACL_AUTHORIZATION_DECRYPT; f->rights[1]=CSSM_ACL_AUTHORIZATION_DB_READ;
 f->entry.EntryPublicInfo.Authorization=(CSSM_AUTHORIZATIONGROUP){2,f->rights};
 f->entry.EntryPublicInfo.TimeRange.StartDate=(CSSM_DATA){sizeof f->date,f->date};
 memcpy(f->entry.EntryPublicInfo.EntryTag,"tag",4); f->entry.EntryHandle=19;
}
static int run(fixture *f,ax_cssm_policy *out) { ax_cssm_range r={f,sizeof *f}; return ax_cssm_copy(&f->owner,1,&f->entry,&r,1,out); }

static fixture exported;static ax_cssm_policy expected_policy;static int mode;static CFDataRef expected_locator;static SecKeychainRef expected_keychain;
OSStatus mock_UI(Boolean x){(void)x;abort();}
CFTypeID mock_Type(void){return CFStringGetTypeID();}
OSStatus mock_Containing(SecKeychainItemRef x,SecKeychainRef*y){(void)x;*y=(SecKeychainRef)CFRetain(mode==4?(CFTypeRef)CFSTR("wrong-keychain"):(CFTypeRef)expected_keychain);return errSecSuccess;}
static SecKeychainAttribute attributes[2];static SecKeychainAttributeList attribute_list;
OSStatus mock_Attributes(SecKeychainItemRef a,SecKeychainAttributeInfo*b,SecItemClass*c,SecKeychainAttributeList**d,UInt32*e,void**f){
 (void)a;assert(b->count==2&&b->tag[0]==kSecServiceItemAttr&&b->tag[1]==kSecAccountItemAttr);assert(!e&&!f);*c=mode==5?0:kSecGenericPasswordItemClass;
 attributes[0]=(SecKeychainAttribute){kSecServiceItemAttr,sizeof AX_SYNTH_SERVICE-1,(void*)AX_SYNTH_SERVICE};
 attributes[1]=(SecKeychainAttribute){kSecAccountItemAttr,(UInt32)strlen(ax_synthetic_account(1)),(void*)ax_synthetic_account(1)};
 attribute_list=(SecKeychainAttributeList){2,attributes};*d=&attribute_list;
 if(mode==6)*d=NULL;if(mode==7)attribute_list.count=1;if(mode==8)attributes[0].tag=0;if(mode==9)attributes[0].data=(void*)"bad";
 if(mode==9)attributes[0].length=3;if(mode==10)attributes[0].data=NULL;if(mode==11)attribute_list.attr=NULL;
 return errSecSuccess;
}
OSStatus mock_FreeAttributes(SecKeychainAttributeList*a,void*b){(void)a;assert(!b);return errSecSuccess;}
OSStatus mock_Access(SecKeychainItemRef a,SecAccessRef*b){(void)a;*b=(SecAccessRef)CFRetain(CFSTR("simulated-access"));return errSecSuccess;}
OSStatus mock_Owner(SecAccessRef a,uid_t*b,gid_t*c,SecAccessOwnerType*d,CFArrayRef*e){(void)a;*b=mode==12?1:0;*c=mode==13?1:0;*d=mode==14?0:kSecUseOnlyUID;*e=CFArrayCreate(NULL,NULL,0,&kCFTypeArrayCallBacks);return errSecSuccess;}
OSStatus mock_Export(SecAccessRef a,CSSM_ACL_OWNER_PROTOTYPE_PTR*b,uint32*c,CSSM_ACL_ENTRY_INFO_PTR*d){(void)a;*b=&exported.owner;*c=mode==15?2:mode==16?0:1;*d=&exported.entry;return errSecSuccess;}
OSStatus mock_Open(const char*a,SecKeychainRef*b){(void)a;(void)b;abort();}
OSStatus mock_Match(CFDictionaryRef a,CFTypeRef*b){
 NSDictionary*q=(__bridge NSDictionary*)a;assert(q.count==5);assert([q[(__bridge id)kSecClass] isEqual:(__bridge id)kSecClassGenericPassword]);
 NSArray*items=q[(__bridge id)kSecMatchItemList];NSArray*search=q[(__bridge id)kSecMatchSearchList];assert(items.count==1&&(__bridge CFTypeRef)items[0]==expected_locator);assert(search.count==1&&(__bridge CFTypeRef)search[0]==expected_keychain);
 assert([q[(__bridge id)kSecMatchLimit] isEqual:(__bridge id)kSecMatchLimitOne]);assert([q[(__bridge id)kSecReturnRef] isEqual:@YES]);
 assert(!q[(__bridge id)kSecAttrService]&&!q[(__bridge id)kSecAttrAccount]&&!q[(__bridge id)kSecReturnData]);
 if(mode==1)return errSecAuthFailed;if(mode==2)return errSecSuccess;if(mode==3){*b=CFDataCreate(NULL,NULL,0);return errSecSuccess;}
 *b=CFRetain(CFSTR("simulated-item"));return errSecSuccess;
}
OSStatus mock_Content(SecKeychainItemRef a,SecItemClass*b,SecKeychainAttributeList*c,UInt32*d,void**e){(void)a;(void)b;(void)c;(void)d;(void)e;abort();}
OSStatus mock_FreeContent(SecKeychainAttributeList*a,void*b){(void)a;(void)b;abort();}
int ax_cssm_prepare_once(void){abort();}
const ax_cssm_policy*ax_cssm_prepared_policy(void){return mode==17?NULL:&expected_policy;}
void axiom_private_material_wipe(AxiomPrivateMaterial*m){memset_s(m,sizeof *m,0,sizeof *m);}
int main(void){@autoreleasepool{
 fixture input;init(&input);assert(run(&input,&expected_policy));
 unsigned char byte=3;expected_locator=CFDataCreate(NULL,&byte,1);expected_keychain=(SecKeychainRef)CFSTR("simulated-keychain");
 for(mode=0;mode<=19;mode++){
  init(&exported);exported.entry.EntryPublicInfo.TypedSubject=exported.n[5].Element.Sublist;
  if(mode==18)exported.n[7].WordID=CSSM_ACL_SUBJECT_TYPE_ANY;
  if(mode==19)exported.requirement[0]^=1;
  SecKeychainItemRef item=resolve_reference(expected_locator,expected_keychain,1);
  if(mode==0){assert(item);CFRelease(item);}else assert(!item);
 }
 assert(!resolve_reference(NULL,expected_keychain,1));assert(!resolve_reference(expected_locator,NULL,1));assert(!resolve_reference(expected_locator,expected_keychain,0));
 CFRelease(expected_locator);assert(!axiom_private_supplier_operational());
 puts("PASS actual private scoped resolution + actual CSSM inspector, simulated positive and 19 refusals, all Security functions inert; no startup qualification");
}return 0;}
