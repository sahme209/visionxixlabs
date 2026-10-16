import { expect, it, vi } from "vitest";
import { ResourceManagementClient } from "@azure/arm-resources";
import { logPolicyName } from "@azure/core-rest-pipeline";
import { createSilentAzureLogger, removeAzureHttpLogPolicy } from "../providerClient";
import { input } from "./fixture";
it("uses a closed silent SDK Debugger including log/extend even when enabled", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
        const logger = createSilentAzureLogger();
        expect(logger.enabled).toBe(false);
        logger(input.clientSecret); logger.log(input.clientSecret);
        logger.enabled = true; logger(input.clientSecret); logger.log(input.clientSecret);
        const child = logger.extend("nested"); child.enabled = true; child(input.clientSecret); child.log(input.clientSecret);
        expect(child.namespace).toBe("axiom:azure-enrollment:nested");
        expect(child.destroy()).toBe(false); expect(logger.destroy()).toBe(false);
        expect(stdout).not.toHaveBeenCalled(); expect(stderr).not.toHaveBeenCalled();
    } finally { stdout.mockRestore(); stderr.mockRestore(); }
});
it("removes installed ARM HTTP log policy on the client without changing other clients", () => {
    const credential = { getToken: async () => ({ token: "synthetic", expiresOnTimestamp: Date.now() + 3600000 }) };
    const isolated = new ResourceManagementClient(credential, input.subscriptionId);
    const other = new ResourceManagementClient(credential, input.subscriptionId);
    expect(isolated.pipeline.getOrderedPolicies().some(policy => policy.name === logPolicyName)).toBe(true);
    removeAzureHttpLogPolicy(isolated.pipeline);
    expect(isolated.pipeline.getOrderedPolicies().some(policy => policy.name === logPolicyName)).toBe(false);
    expect(other.pipeline.getOrderedPolicies().some(policy => policy.name === logPolicyName)).toBe(true);
});
