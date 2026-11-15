// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as THREE from "three";
const state = vi.hoisted(() => ({ rendered: [] as Array<{ scene: unknown; camera: unknown }>, instances: [] as Array<{ dispose: ReturnType<typeof vi.fn>; setPixelRatio: ReturnType<typeof vi.fn> }>, shaderFailure: false, renderFailure: false }));
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  class Renderer {
    debug: { onShaderError?: () => void } = {};
    outputColorSpace = "";
    dispose = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    constructor() { state.instances.push(this); }
    render(scene: unknown, camera: unknown) {
      state.rendered.push({ scene, camera });
      if (state.shaderFailure) this.debug.onShaderError?.();
      if (state.renderFailure) throw new Error("synthetic_render_failure");
    }
  }
  return { ...actual, WebGLRenderer: Renderer };
});
import { createOrbitScene } from "../createOrbitScene";
beforeEach(() => {
  state.rendered = []; state.instances = []; state.shaderFailure = false; state.renderFailure = false;
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 7));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
});
afterEach(() => { vi.unstubAllGlobals(); });
function canvas() {
  const node = document.createElement("canvas");
  vi.spyOn(node, "getBoundingClientRect").mockReturnValue({ width: 1440, height: 900, x: 0, y: 0, top: 0, left: 0, right: 1440, bottom: 900, toJSON: () => ({}) });
  return node;
}
it("uses a real depth surface and perspective camera with a seamless normal boundary, initially idle", () => {
  const handle = createOrbitScene(canvas(), vi.fn());
  const { scene, camera } = state.rendered[0] as { scene: THREE.Scene; camera: THREE.PerspectiveCamera };
  expect(camera.isPerspectiveCamera).toBe(true);
  expect(camera.aspect).toBe(1440 / 900);
  expect(requestAnimationFrame).not.toHaveBeenCalled();
  expect(state.instances[0].setPixelRatio).toHaveBeenLastCalledWith(1.5);
  const mesh = scene.children.find(node => (node as THREE.Mesh).isMesh) as THREE.Mesh<THREE.BufferGeometry>;
  const positions = mesh.geometry.getAttribute("position"), normals = mesh.geometry.getAttribute("normal");
  expect(positions.count).toBeGreaterThan(10000);
  expect(positions.getZ(positions.count - 1)).toBeLessThan(positions.getZ(0) - 6);
  for (let row = 0; row <= 110; row++) {
    const first = row * 193, last = first + 192;
    for (const key of ["getX", "getY", "getZ"] as const) {
      expect(positions[key](first)).toBeCloseTo(positions[key](last), 5);
      expect(normals[key](first)).toBeCloseTo(normals[key](last), 6);
      expect(Number.isFinite(normals[key](first))).toBe(true);
    }
  }
  handle.dispose();
});
it("pauses scheduled work and releases all owned geometry/material resources exactly once", () => {
  const handle = createOrbitScene(canvas(), vi.fn());
  const scene = state.rendered[0].scene as THREE.Scene;
  const releases = scene.children.flatMap(node => {
    const mesh = node as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    return [vi.spyOn(mesh.geometry, "dispose"), vi.spyOn(mesh.material, "dispose")];
  });
  handle.setPaused(false); expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  handle.setPaused(true); expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
  handle.dispose(); handle.dispose(); handle.setPaused(false); handle.resize(390, 844);
  for (const release of releases) expect(release).toHaveBeenCalledTimes(1);
  expect(state.instances[0].dispose).toHaveBeenCalledTimes(1);
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
});
it("notifies once and stops after context loss", () => {
  const node = canvas(), unavailable = vi.fn();
  const handle = createOrbitScene(node, unavailable);
  const event = new Event("webglcontextlost", { cancelable: true });
  node.dispatchEvent(event); node.dispatchEvent(new Event("webglcontextlost")); handle.setPaused(false);
  expect(event.defaultPrevented).toBe(true); expect(unavailable).toHaveBeenCalledTimes(1);
  expect(state.instances[0].dispose).toHaveBeenCalledTimes(1); expect(requestAnimationFrame).not.toHaveBeenCalled();
});
it.each(["shaderFailure", "renderFailure"] as const)("keeps failed initial %s unavailable and disposes it", failure => {
  state[failure] = true;
  const unavailable = vi.fn();
  expect(() => createOrbitScene(canvas(), unavailable)).toThrow("orbit_scene_unavailable");
  expect(unavailable).toHaveBeenCalledTimes(1);
  expect(state.instances[0].dispose).toHaveBeenCalledTimes(1);
});
