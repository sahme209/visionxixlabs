"""LOCAL UNDEPLOYED callback. No secrets/events/proofs may be logged.
Policies and immutable hosting remain separately reviewed activation gates.
"""
import json
import os
import re
import urllib.request
import urllib.parse
import boto3
from botocore.config import Config


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("callback_redirect_refused")


def handler(event, context):
    properties = event.get("ResourceProperties", {})
    flow_id = properties.get("FlowId", "")
    if not re.fullmatch(r"aws_flow_[a-f0-9]{64}", flow_id):
        raise ValueError("callback_flow_invalid")
    response_url = urllib.parse.urlsplit(event["ResponseURL"])
    if response_url.scheme != "https" or response_url.username or response_url.password or response_url.port or not re.fullmatch(r"cloudformation-custom-resource-response-[a-z0-9-]+\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com", response_url.hostname or ""):
        raise ValueError("cloudformation_response_untrusted")
    operation = event.get("RequestType")
    if operation not in ("Create", "Update", "Delete"):
        raise ValueError("callback_operation_unsupported")
    opener = urllib.request.build_opener(NoRedirect())
    status = "SUCCESS"
    if operation == "Create":
        try:
            region = os.environ["AWS_REGION"]
            if not re.fullmatch(r"us-(east|west)-[12]", region):
                raise ValueError("callback_region_unsupported")
            # This signs locally. The server verifies the exact per-flow role.
            signed = boto3.client("sts", region_name=region, endpoint_url=f"https://sts.{region}.amazonaws.com", config=Config(signature_version="v4", retries={"max_attempts": 0})).generate_presigned_url(
                "get_caller_identity", Params={}, ExpiresIn=30, HttpMethod="GET"
            )
            payload = json.dumps({"flowId": flow_id, "proof": {
                "signedIdentityRequest": signed, "stackId": event["StackId"], "region": region
            }}).encode("utf-8")
            req = urllib.request.Request(
                "https://visionxixlabs.com/api/cloud/aws/guided/callback",
                data=payload, headers={"Content-Type": "application/json"}, method="POST"
            )
            # Exactly one callback dispatch; never retry after ambiguous outcome.
            with opener.open(req, timeout=8) as response:
                if response.status != 200 or len(response.read(4097)) > 4096:
                    raise ValueError("callback_outcome_unknown")
        except Exception:
            status = "FAILED"
    elif operation == "Update":
        # A new immutable stack/flow is required; updates never reuse authority.
        status = "FAILED"
    # Delete ACK changes no Axiom saved connection; disconnect is separate.
    acknowledgment = json.dumps({
        "Status": status, "Reason": "Axiom callback processed; inspect saved connection status",
        "PhysicalResourceId": flow_id, "StackId": event["StackId"],
        "RequestId": event["RequestId"], "LogicalResourceId": event["LogicalResourceId"],
        "NoEcho": True, "Data": {}
    }).encode("utf-8")
    req = urllib.request.Request(event["ResponseURL"], data=acknowledgment,
                                 headers={"Content-Type": ""}, method="PUT")
    with opener.open(req, timeout=5) as response:
        if response.status not in (200, 201):
            raise ValueError("cloudformation_ack_unknown")
    return {"callbackAcknowledged": True, "connectionVerifiedByServerOnly": True}
