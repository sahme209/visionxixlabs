#ifndef AX_SYNTHETIC_FIXTURE_READINESS_H
#define AX_SYNTHETIC_FIXTURE_READINESS_H
/* Actual private native observations, never caller metadata or a ready flag. */
int ax_fixture_selected_principals(void);
int ax_fixture_protected_file(const char*path,int directory);
int ax_fixture_maintenance_current(void);
int ax_fixture_supplier_context_current(void);
#endif
