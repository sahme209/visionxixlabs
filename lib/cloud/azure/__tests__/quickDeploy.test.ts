import { describe, expect, it } from "vitest";
import { buildAzureDeployUrl } from "../quickDeploy";

describe("buildAzureDeployUrl", () => {
  it("returns the portal.azure.com deep-link with the encoded template URI", () => {
    const url = buildAzureDeployUrl({ origin: "https://visionxixlabs.com" });
    expect(url.startsWith("https://portal.azure.com/#create/Microsoft.Template/uri/")).toBe(true);
    // Template URI is URL-encoded (so the second `/` in `https://` is `%2F`).
    expect(url).toContain("https%3A%2F%2Fvisionxixlabs.com%2Fazure%2Faxiom-agent-reader.json");
  });

  it("strips trailing slash from origin so the encoded URI has no double slash", () => {
    const url = buildAzureDeployUrl({ origin: "https://visionxixlabs.com/" });
    expect(url).not.toContain("visionxixlabs.com%2F%2F");
  });

  it("works with non-https origins for local dev", () => {
    const url = buildAzureDeployUrl({ origin: "http://localhost:3000" });
    expect(url).toContain("http%3A%2F%2Flocalhost%3A3000%2Fazure%2Faxiom-agent-reader.json");
  });
});
