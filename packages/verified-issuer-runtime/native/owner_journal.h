#ifndef AXIOM_OWNER_JOURNAL_H
#define AXIOM_OWNER_JOURNAL_H
#include <stddef.h>
#include <stdint.h>
#define AX_OWNER_RECORD_SIZE 32U
#define AX_OWNER_MAX_RECORDS 5U
enum { AX_OWNER_JOURNAL_EMPTY=0, AX_OWNER_JOURNAL_RESERVED=1, AX_OWNER_JOURNAL_INTENT=2,
 AX_OWNER_JOURNAL_CREATED=3, AX_OWNER_JOURNAL_EXITED=4, AX_OWNER_JOURNAL_UNKNOWN=5 };
enum { AX_OWNER_REASON_NONE=0, AX_OWNER_REASON_CREATE=1, AX_OWNER_REASON_APPEND=2,
 AX_OWNER_REASON_FILE_BARRIER=3, AX_OWNER_REASON_DIR_BARRIER=4, AX_OWNER_REASON_CLOSE=5,
 AX_OWNER_REASON_STATE=6, AX_OWNER_REASON_CHILD=7, AX_OWNER_REASON_UNSUPPORTED=8 };
/* Private injected I/O ports. Callbacks are not authority; mocked success cannot
 * qualify installed ownership, platform durability or startup admission. */
typedef struct {
 void *context;
 int (*create)(void *);
 int (*append)(void *,const unsigned char *,size_t);
 int (*full_file_barrier)(void *);
 int (*full_dir_barrier)(void *);
 int (*close)(void *);
} AxOwnerJournalOps;
typedef struct {
 AxOwnerJournalOps ops;
 uint32_t sequence;
 unsigned phase,reason;
 int attempted,failed,closed;
} AxOwnerJournal;
int ax_owner_journal_reserve(AxOwnerJournal *,const AxOwnerJournalOps *);
int ax_owner_journal_intent(AxOwnerJournal *);
int ax_owner_journal_created(AxOwnerJournal *);
int ax_owner_journal_exited(AxOwnerJournal *);
int ax_owner_journal_unknown(AxOwnerJournal *,unsigned reason);
int ax_owner_journal_close(AxOwnerJournal *);
/* Observation only; decoding never permits resumption or launch. */
int ax_owner_journal_decode(const unsigned char *,size_t,unsigned *phase,uint32_t *sequence,unsigned *reason);
#endif
