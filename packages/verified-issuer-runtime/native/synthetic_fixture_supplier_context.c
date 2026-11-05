#include "synthetic_fixture_readiness.h"
#include "owner_config.h"
#include "origin_owner_binding.h"
#include <unistd.h>
int ax_fixture_supplier_context_current(void){return ax_fixture_selected_principals()&&getuid()==AX_OWNER_FIXED_UID&&geteuid()==AX_OWNER_FIXED_UID&&getgid()==AX_OWNER_FIXED_GID&&getegid()==AX_OWNER_FIXED_GID&&axiom_owner_binding_current()&&ax_fixture_protected_file(AX_SYNTH_BROKER,0)&&ax_fixture_protected_file(AX_SYNTH_LOCATOR_PATH,0);}
