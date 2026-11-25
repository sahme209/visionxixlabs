import { describe, expect, it, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";
import { proxy as routeProxy } from "@/proxy";

// Only GET/HEAD / is asynchronous (it reads the session token); these paths return synchronously.
const proxy = (input: NextRequest) => routeProxy(input) as NextResponse;
describe("cockpit route compatibility",()=>{
 it("keeps old team form return notices inside the cockpit",()=>{
  const response=proxy(new NextRequest("https://visionxixlabs.com/dashboard/team?notice=role_updated"));
  expect(response.headers.get("location")).toBe("https://visionxixlabs.com/control/members?notice=role_updated");
 });
 it("overwrites a caller-supplied cockpit return header with actual path and interval",()=>{
  const response=proxy(new NextRequest("https://visionxixlabs.com/control/plans?plan=pro&interval=annual",{headers:{"x-axiom-cockpit-path":"https://evil.test"}}));
  expect(response.headers.get("x-middleware-request-x-axiom-cockpit-path")).toBe("/control/plans?plan=pro&interval=annual");
 });
 it("continues to block legacy browser cloud operations",()=>{
  expect(proxy(new NextRequest("https://visionxixlabs.com/dashboard/azure")).headers.get("location")).toContain("/download?from=");
 });
});
it('migrates the old platform App setup URL into the protected admin area with its result notice',()=>{
 expect(proxy(new NextRequest('https://visionxixlabs.com/dashboard/github-app?created=1')).headers.get('location')).toBe('https://visionxixlabs.com/admin/github-app?created=1');
});


it("allows Stripe frames and scripts only on the exact enabled test setup page", () => {
  const path = "/control/usage-billing/automatic-top-up";
  const policy = (target: string) => proxy(new NextRequest(`https://visionxixlabs.com${target}`)).headers.get("content-security-policy");
  try {
    vi.stubEnv("AXIOM_AUTO_TOP_UP_SETUP_TEST_ENABLED", "");
    vi.stubEnv("AXIOM_STRIPE_TEST_PUBLISHABLE_KEY", "pk_test_fixture");
    vi.stubEnv("AXIOM_STRIPE_MODE", "test");
    expect(policy(path)).not.toContain("stripe.com");
    vi.stubEnv("AXIOM_AUTO_TOP_UP_SETUP_TEST_ENABLED", "true");
    expect(policy(path)).toContain("https://js.stripe.com");
    expect(policy(path)).toContain("https://hooks.stripe.com");
    expect(policy("/control/usage-billing")).not.toContain("stripe.com");
    expect(policy("/api/billing/automatic-top-up")).not.toContain("stripe.com");
    vi.stubEnv("AXIOM_STRIPE_MODE", "live");
    expect(policy(path)).not.toContain("stripe.com");
  } finally {
    vi.unstubAllEnvs();
  }
});
