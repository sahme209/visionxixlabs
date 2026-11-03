#ifndef AXIOM_UNIT_DEADLINE_H
#define AXIOM_UNIT_DEADLINE_H
#include <dispatch/dispatch.h>
#include <unistd.h>
/* Diagnostic fixture only, independent of broker and JS/event-loop progress. */
static void origin_unit_self_deadline(void){dispatch_after(dispatch_time(DISPATCH_TIME_NOW,15000000000LL),dispatch_get_global_queue(QOS_CLASS_USER_INITIATED,0),^{_exit(75);});}
#endif
