/** Shared client checks for the marketing 3D models (homepage and product). */
export function supportsWebGL(): boolean {
  if (typeof window === "undefined" || typeof WebGLRenderingContext === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    // failIfMajorPerformanceCaveat refuses software rendering (no GPU), where the scene would
    // saturate the main thread; those visitors get the 2D stage rail instead.
    const opts: WebGLContextAttributes = { failIfMajorPerformanceCaveat: true };
    const gl = probe.getContext("webgl2", opts) ?? probe.getContext("webgl", opts);
    if (!gl) return false;
    // Some software GPUs (e.g. SwiftShader in headless Chrome) do not raise the caveat; refuse them by name too.
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}

/** Browser-local override used only by the software-render capture job: `localStorage["axiom:force-3d"]="1"`
 * skips the GPU check and frame guard in that one browser. It cannot affect other visitors. */
export function forced3d(): boolean {
  try { return typeof window !== "undefined" && window.localStorage.getItem("axiom:force-3d") === "1"; } catch { return false; }
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
