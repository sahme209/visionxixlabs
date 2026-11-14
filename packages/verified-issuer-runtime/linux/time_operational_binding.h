#ifndef AXIOM_TIME_OPERATIONAL_BINDING_H
#define AXIOM_TIME_OPERATIONAL_BINDING_H
#include "time_parent_binding.h"
#include "time_operational_status.h"
/* Called ONCE by the fixed installed module initializer, not JS. The independent
 * protected startup owns/qualifies these resources. No default addon installed. */
napi_status axiom_time_operational_create_private(napi_env,
 const struct axiom_time_parent_bootstrap *,napi_value *);
#endif
