#ifndef AX_FIXTURE_CONTROLLER_STATE_H
#define AX_FIXTURE_CONTROLLER_STATE_H
typedef struct {int started,ready,stopped;} AxFixtureControllerState;
int ax_fixture_controller_started(AxFixtureControllerState*,int authenticated,int exact);
int ax_fixture_controller_notice(AxFixtureControllerState*,int authenticated,int exact);
int ax_fixture_controller_can_request(const AxFixtureControllerState*);
int ax_fixture_controller_take_ready(AxFixtureControllerState*);
void ax_fixture_controller_stop(AxFixtureControllerState*);
#endif
