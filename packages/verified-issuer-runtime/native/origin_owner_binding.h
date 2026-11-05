#ifndef AXIOM_ORIGIN_OWNER_BINDING_H
#define AXIOM_ORIGIN_OWNER_BINDING_H
/* Private native-only, no setter/caller receipt. Closed preparation defaults. */
int axiom_owner_binding_startup(void);
int axiom_owner_binding_current(void);
void axiom_owner_binding_revoke(void);
#endif
