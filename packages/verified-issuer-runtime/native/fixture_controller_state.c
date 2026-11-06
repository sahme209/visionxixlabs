#include "fixture_controller_state.h"
void ax_fixture_controller_stop(AxFixtureControllerState*s){if(s)s->stopped=1;}
int ax_fixture_controller_started(AxFixtureControllerState*s,int authenticated,int exact){if(!s||s->stopped||s->started||!authenticated||!exact){ax_fixture_controller_stop(s);return 0;}s->started=1;return 1;}
int ax_fixture_controller_notice(AxFixtureControllerState*s,int authenticated,int exact){if(!s||s->stopped||s->ready||!authenticated||!exact){ax_fixture_controller_stop(s);return 0;}s->ready=1;return 1;}
int ax_fixture_controller_can_request(const AxFixtureControllerState*s){return s&&!s->stopped&&s->started&&s->ready;}

int ax_fixture_controller_take_ready(AxFixtureControllerState*s){if(!ax_fixture_controller_can_request(s))return 0;s->ready=0;return 1;}
