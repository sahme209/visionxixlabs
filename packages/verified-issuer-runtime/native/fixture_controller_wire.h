#ifndef AX_FIXTURE_CONTROLLER_WIRE_H
#define AX_FIXTURE_CONTROLLER_WIRE_H
#define AX_FIXTURE_HELLO_SIZE 80U
#define AX_FIXTURE_ECHO_SIZE 40U
#define AX_FIXTURE_RESULT_SIZE 12U
/* fd3 parent->owned controller, fd4 controller->parent. No public socket. */
#define AX_FIXTURE_HELLO "AXQHELLO"
#define AX_FIXTURE_ECHO "AXQREADY"
#define AX_FIXTURE_RESULT "AXQCASE1"
#define AX_FIXTURE_DONE "AXQDONE1"
#endif
