#ifndef AX_SYNTHETIC_RESOURCE_CONTRACT_H
#define AX_SYNTHETIC_RESOURCE_CONTRACT_H
#include <stddef.h>
#include <stdint.h>
#include <stdatomic.h>
#include <string.h>
/* Candidate installation identity only. Never proof of installation or custody. */
#define AX_SYNTH_GENERATION "c3b7bf334ce56a64575183b7a66e5109"
#define AX_SYNTH_SOCKET_PATH "/Library/AxiomQ/" AX_SYNTH_GENERATION "/socket"
#define AX_SYNTH_ROOT "/Library/Application Support/Vision XIX Labs/Axiom Synthetic Custodian/generations/" AX_SYNTH_GENERATION
#define AX_SYNTH_APP AX_SYNTH_ROOT "/Axiom Synthetic Custodian.app"
#define AX_SYNTH_BROKER_SUFFIX "/Contents/MacOS/AxiomIssuerBroker"
#define AX_SYNTH_BROKER AX_SYNTH_APP AX_SYNTH_BROKER_SUFFIX
#define AX_SYNTH_LOCATOR_PATH AX_SYNTH_ROOT "/bootstrap-locators.v1"
#define AX_SYNTH_JOURNAL_PATH AX_SYNTH_ROOT "/bootstrap-transaction.v1"
#define AX_SYNTH_KEYCHAIN_PATH "/Library/Keychains/System.keychain"
#define AX_SYNTH_SERVICE "com.visionxixlabs.axiom.synthetic.bootstrap." AX_SYNTH_GENERATION
#define AX_SYNTH_LOCATOR_MAX 16384U
#define AX_SYNTH_RECORD_MAX 65536U
#define AX_SYNTH_JOURNAL_RECORD 32U
static inline int ax_synthetic_control_app_matches(const char *candidate){return candidate&&!strcmp(candidate,AX_SYNTH_APP);}
typedef struct {size_t length[3];unsigned char bytes[3][AX_SYNTH_LOCATOR_MAX];} AxSyntheticLocators;
typedef struct {uint32_t sequence;uint8_t phase;} AxSyntheticJournal;
enum {AX_SYNTH_REASON_NONE=0,AX_SYNTH_DUPLICATE=1,AX_SYNTH_ADD_REFUSED=2,
 AX_SYNTH_INVALID_LOCATOR=3,AX_SYNTH_IO=4,AX_SYNTH_DURABILITY=5,
 AX_SYNTH_PUBLICATION_COLLISION=6,AX_SYNTH_UNKNOWN_EFFECT=7,AX_SYNTH_UNSUPPORTED=8};
enum {AX_SYNTH_ADD_OK=0,AX_SYNTH_ADD_DUPLICATE=1,AX_SYNTH_ADD_FAILED=2,AX_SYNTH_ADD_UNKNOWN=3};
enum {AX_SYNTH_PUBLISH_OK=1,AX_SYNTH_PUBLISH_COLLISION=0,AX_SYNTH_PUBLISH_IO=-1,
 AX_SYNTH_PUBLISH_UNKNOWN=-2,AX_SYNTH_PUBLISH_UNSUPPORTED=-3};
/* Private maintenance composition ports; no runtime registration or authority. */
typedef struct {
 void *context;
 int (*journal)(void *,const unsigned char[AX_SYNTH_JOURNAL_RECORD]);
 int (*add)(void *,unsigned,unsigned char[AX_SYNTH_LOCATOR_MAX],size_t *);
 int (*publish)(void *,const AxSyntheticLocators *);
} AxSyntheticProvisionOps;
typedef struct {atomic_flag attempted;} AxSyntheticProvisionOnce;
typedef struct {unsigned phase,reason,adds_started;int locators_published;} AxSyntheticProvisionResult;
const char *ax_synthetic_account(unsigned role);
int ax_synthetic_locator_encode(const AxSyntheticLocators *,unsigned char[AX_SYNTH_RECORD_MAX],size_t *);
int ax_synthetic_locator_decode(const unsigned char *,size_t,AxSyntheticLocators *);
int ax_synthetic_journal_next(AxSyntheticJournal *,unsigned phase,unsigned reason,unsigned char[32]);
int ax_synthetic_journal_decode(const unsigned char *,size_t,AxSyntheticJournal *);
AxSyntheticProvisionResult ax_synthetic_provision_once(AxSyntheticProvisionOnce *,const AxSyntheticProvisionOps *);
#endif
