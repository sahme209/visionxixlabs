import { describe, expect, it } from "vitest";
import { microsoftCredentialRefreshDue, parseStoredMicrosoftCredential } from "../microsoftCredential";

describe("stored Microsoft credentials", () => {
  it("accepts only an access token and normalizes optional refresh data", () => {
    expect(parseStoredMicrosoftCredential(JSON.stringify({ accessToken: "access", refreshToken: "refresh", expiresAt: 1000 })))
      .toEqual({ accessToken: "access", refreshToken: "refresh", expiresAt: 1000 });
    expect(parseStoredMicrosoftCredential(JSON.stringify({ accessToken: "access" })))
      .toEqual({ accessToken: "access", refreshToken: null, expiresAt: null });
  });

  it("refreshes only a token with a refresh credential near expiry", () => {
    expect(microsoftCredentialRefreshDue({ accessToken: "a", refreshToken: "r", expiresAt: 1_000 }, 950)).toBe(true);
    expect(microsoftCredentialRefreshDue({ accessToken: "a", refreshToken: null, expiresAt: 1_000 }, 950)).toBe(false);
  });
});

it('preserves explicit action-consent grants and refuses missing action scope evidence',()=>{const scopes=['User.Read','Team.ReadBasic.All','Channel.ReadBasic.All','ChannelMessage.Send'];expect(parseStoredMicrosoftCredential(JSON.stringify({accessToken:'access',refreshToken:'refresh',expiresAt:1000,purpose:'connected_app_actions_v1',actionScopes:scopes}))).toMatchObject({purpose:'connected_app_actions_v1',actionScopes:scopes});expect(parseStoredMicrosoftCredential(JSON.stringify({accessToken:'access',purpose:'connected_app_actions_v1'}))).toBeNull()});
