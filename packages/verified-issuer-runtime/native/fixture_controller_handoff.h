#ifndef AX_FIXTURE_CONTROLLER_HANDOFF_H
#define AX_FIXTURE_CONTROLLER_HANDOFF_H
#include <stddef.h>
#include <stdint.h>
/* Private maintenance composition: fixed own child/pipe/current code only.
 * No caller-supplied FD, PID, principal, path, requirement or proof boolean. */
int ax_fixture_controller_handoff(const unsigned char*,size_t,uint64_t deadline_ms);
#endif
