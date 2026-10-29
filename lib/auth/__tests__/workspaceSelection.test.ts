import { expect, it } from "vitest";
import { readWorkspaceSelection } from "../workspaceSelection";
it("ignores another identity's preference and malformed values", () => {
 expect(readWorkspaceSelection(JSON.stringify({ userId: "old", organizationId: "shared" }), "new")).toBeNull();
 for (const value of ["invalid", "{}", JSON.stringify({ userId: "one", organizationId: "../other" }), "x".repeat(1025)]) expect(readWorkspaceSelection(value, "one")).toBeNull();
 expect(readWorkspaceSelection(JSON.stringify({ userId: "one", organizationId: "shared" }), "one")).toBe("shared");
});
