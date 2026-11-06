#ifndef AX_FIXTURE_AUTHORIZATION_FRAME_H
#define AX_FIXTURE_AUTHORIZATION_FRAME_H
#include <stddef.h>
#include <stdint.h>
#define AX_FIXTURE_AUTH_PAYLOAD_MAX 65536U
#define AX_FIXTURE_AUTH_HEADER 44U
#define AX_FIXTURE_AUTH_FRAME_MAX (AX_FIXTURE_AUTH_HEADER+AX_FIXTURE_AUTH_PAYLOAD_MAX)
#define AX_FIXTURE_SCENARIOS_MAX 64U
typedef enum {AX_FIXTURE_READ_EXECUTION,AX_FIXTURE_PREPARE_ENROLLED,AX_FIXTURE_EXECUTE_ENROLLED,AX_FIXTURE_CANCEL_PREPARED,AX_FIXTURE_READ_OPERATION,AX_FIXTURE_EXECUTE_UNKNOWN,AX_FIXTURE_RECOVER_UNKNOWN,AX_FIXTURE_REVOKE_BEFORE_CLAIM,AX_FIXTURE_REVOKE_AFTER_AWAIT,AX_FIXTURE_REVOKE_BEFORE_SEND,AX_FIXTURE_CASE_COUNT} AxFixtureCase;
typedef struct {AxFixtureCase case_id;char request_id[161],plan_id[78],client_request_id[37];unsigned expected_version;} AxFixtureScenario;
typedef struct {char requester_token[256],reviewer_token[256];size_t count;AxFixtureScenario scenarios[AX_FIXTURE_SCENARIOS_MAX];} AxFixtureAuthorization;
typedef struct {unsigned char bytes[AX_FIXTURE_AUTH_FRAME_MAX];size_t used;int ended,failed;} AxFixtureAuthorizationStream;
int ax_fixture_authorization_stream_feed(AxFixtureAuthorizationStream*,const unsigned char*,size_t);
int ax_fixture_authorization_stream_end(AxFixtureAuthorizationStream*,AxFixtureAuthorization*);
void ax_fixture_authorization_stream_wipe(AxFixtureAuthorizationStream*);
int ax_fixture_authorization_decode(const unsigned char*,size_t,AxFixtureAuthorization*);
int ax_fixture_authorization_encode(const AxFixtureAuthorization*,unsigned char*,size_t,size_t*);
void ax_fixture_authorization_wipe(AxFixtureAuthorization*);
const char*ax_fixture_case_name(AxFixtureCase);
const char*ax_fixture_case_operation(AxFixtureCase);
int ax_fixture_scenario_request(const AxFixtureAuthorization*,size_t,unsigned char*,size_t,size_t*,unsigned*);
#endif
