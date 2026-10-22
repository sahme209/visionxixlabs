import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
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
