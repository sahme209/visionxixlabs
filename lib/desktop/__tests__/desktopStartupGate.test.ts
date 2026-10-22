/** @vitest-environment jsdom */
import { createElement, StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
const mocks=vi.hoisted(()=>({hydrate:vi.fn(),app:vi.fn()}));
vi.mock("../../../desktop/src/lib/activeDesktopCredential",()=>({hydrateDesktopCredential:mocks.hydrate}));
vi.mock("../../../desktop/src/App",()=>({default:()=>{mocks.app();return createElement("div",null,"Verified-app boundary");}}));
import { DesktopStartupGate } from "../../../desktop/src/DesktopStartupGate";
beforeEach(()=>{vi.clearAllMocks();mocks.hydrate.mockImplementation(()=>new Promise(()=>{}));});
afterEach(cleanup);
it("renders a locked startup status before secure storage settles",()=>{
 render(createElement(DesktopStartupGate));
 expect(screen.getByRole("status").textContent).toContain("secure sign-in");
 expect(screen.queryByText("Verified-app boundary")).toBeNull();expect(mocks.app).not.toHaveBeenCalled();
});
it("mounts the existing App verification boundary only after hydration resolves",async()=>{
 let finish!:()=>void;mocks.hydrate.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
 render(createElement(DesktopStartupGate));expect(mocks.app).not.toHaveBeenCalled();
 await act(async()=>finish());expect(screen.getByText("Verified-app boundary")).toBeTruthy();expect(screen.queryByRole("status")).toBeNull();
});
it("allows existing locked sign-in recovery after a rejected vault read without showing raw details",async()=>{
 mocks.hydrate.mockRejectedValue(new Error("private vault diagnostic"));render(createElement(DesktopStartupGate));
 await screen.findByText("Verified-app boundary");expect(screen.queryByText(/private vault/)).toBeNull();
});
it("does not run duplicate secure-storage hydration under StrictMode",async()=>{
 let finish!:()=>void;mocks.hydrate.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
 render(createElement(StrictMode,null,createElement(DesktopStartupGate)));expect(mocks.hydrate).toHaveBeenCalledOnce();
 await act(async()=>finish());expect(screen.getByText("Verified-app boundary")).toBeTruthy();
});
it("does not mount App after the startup gate has unmounted",async()=>{
 let finish!:()=>void;mocks.hydrate.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
 const view=render(createElement(DesktopStartupGate));view.unmount();await act(async()=>finish());
 expect(mocks.app).not.toHaveBeenCalled();
});
