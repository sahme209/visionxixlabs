import * as THREE from "three";
import { quietOrbitFragment, quietOrbitVertex } from "./quietOrbitShaders";

export interface OrbitSceneHandle {
  setPaused(value: boolean): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

/** Original spatial conduit. No product/customer data, network assets or operational state. */
export function createOrbitScene(canvas: HTMLCanvasElement, onUnavailable: () => void): OrbitSceneHandle {
  let disposed = false, paused = true, frame = 0, last = 0, elapsed = 0;
  let shaderFailed = false, notified = false;
  let renderer: THREE.WebGLRenderer | undefined;
  let updateScene: ((time: number) => void) | undefined;
  let camera: THREE.PerspectiveCamera | undefined;
  const scene = new THREE.Scene();
  const resources: Array<{ dispose(): void }> = [];
  const own = <T extends { dispose(): void }>(value: T): T => { resources.push(value); return value; };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame); frame = 0;
    canvas.removeEventListener("webglcontextlost", contextLost);
    for (const resource of resources) resource.dispose();
    resources.length = 0;
    scene.clear();
    renderer?.dispose();
    updateScene = undefined;
  };
  const unavailable = () => {
    dispose();
    if (!notified) { notified = true; onUnavailable(); }
  };
  const contextLost = (event: Event) => { event.preventDefault(); unavailable(); };
  const draw = () => {
    if (disposed || !renderer || !camera) return;
    try {
      updateScene?.(elapsed);
      renderer.render(scene, camera);
      if (shaderFailed) unavailable();
    } catch { unavailable(); }
  };
  const tick = (now: number) => {
    frame = 0;
    if (disposed || paused) return;
    if (now - last >= 40) {
      elapsed += Math.min((now - last) / 1000, .08);
      last = now;
      draw();
    }
    if (!disposed && !paused) frame = requestAnimationFrame(tick);
  };
  const resize = (width: number, height: number) => {
    if (disposed || !renderer || !camera || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    try {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = width < 600 ? 48 : 40;
      camera.updateProjectionMatrix();
      draw();
    } catch { unavailable(); }
  };
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true, powerPreference: "low-power" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.debug.onShaderError = () => { shaderFailed = true; };
    canvas.addEventListener("webglcontextlost", contextLost);
    scene.background = new THREE.Color("#0a0908");
    camera = new THREE.PerspectiveCamera(40, 1, .1, 45);
    camera.position.set(.28, .02, 6.15);
    camera.lookAt(.05, .36, -2.5);

    const point = (depth: number, angle: number, lift = 0): [number, number, number] => {
      const radius = .95 + 3.3 * Math.pow(1 - depth, 1.7);
      const twist = angle + depth * 4.3;
      const folds = (Math.sin(twist * 4 + depth * 8) * .075 + Math.sin(twist * 7 - depth * 6) * .032 + Math.sin(twist * 11 + depth * 12) * .012) * Math.sin(Math.PI * depth);
      const foldedRadius = radius * (1 + folds) + lift;
      return [foldedRadius * Math.cos(angle) + .22 * Math.sin(depth * 3.4), 2.18 + depth * 2 + foldedRadius * Math.sin(angle), .3 - depth * 7.4];
    };
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    const rows = 110, columns = 192;
    for (let row = 0; row <= rows; row++) {
      for (let column = 0; column <= columns; column++) {
        const depth = row / rows, angle = column / columns * Math.PI * 2;
        positions.push(...point(depth, angle)); uvs.push(column / columns, depth);
        if (row < rows && column < columns) {
          const vertex = row * (columns + 1) + column;
          indices.push(vertex, vertex + columns + 1, vertex + 1, vertex + 1, vertex + columns + 1, vertex + columns + 2);
        }
      }
    }
    const geometry = own(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    // The duplicated UV edge is one physical surface, with matching normals.
    const normals = geometry.getAttribute("normal");
    const seamNormal = new THREE.Vector3();
    for (let row = 0; row <= rows; row++) {
      const first = row * (columns + 1), lastVertex = first + columns;
      seamNormal.set(normals.getX(first) + normals.getX(lastVertex), normals.getY(first) + normals.getY(lastVertex), normals.getZ(first) + normals.getZ(lastVertex)).normalize();
      normals.setXYZ(first, seamNormal.x, seamNormal.y, seamNormal.z);
      normals.setXYZ(lastVertex, seamNormal.x, seamNormal.y, seamNormal.z);
    }
    normals.needsUpdate = true;
    const uniforms = { time: { value: 0 }, eye: { value: camera.position } };
    const material = own(new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms, vertexShader: quietOrbitVertex, fragmentShader: quietOrbitFragment }));
    scene.add(new THREE.Mesh(geometry, material));

    const packetPositions = new Float32Array(72 * 3);
    const packetGeometry = own(new THREE.BufferGeometry());
    packetGeometry.setAttribute("position", new THREE.BufferAttribute(packetPositions, 3));
    const packetMaterial = own(new THREE.PointsMaterial({ color: 0xbfbdb6, size: .012, sizeAttenuation: true, transparent: true, opacity: .52, depthWrite: false }));
    scene.add(new THREE.Points(packetGeometry, packetMaterial));
    updateScene = (time) => {
      uniforms.time.value = time;
      for (let index = 0; index < 72; index++) {
        const depth = (index * .61803398875 + time * .008) % 1;
        const angle = index * 2.3999632297 + depth * 4.3;
        packetPositions.set(point(depth, angle, -.014), index * 3);
      }
      packetGeometry.getAttribute("position").needsUpdate = true;
    };
    const stars: number[] = [];
    const seededFraction = (seed: number) => { const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };
    for (let index = 0; index < 100; index++) stars.push((seededFraction(index + 4) - .5) * 32, (seededFraction(index + 81) - .4) * 18, -12 - seededFraction(index + 130) * 8);
    const starGeometry = own(new THREE.BufferGeometry());
    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(stars, 3));
    const starMaterial = own(new THREE.PointsMaterial({ color: 0x858585, size: .025, sizeAttenuation: true, transparent: true, opacity: .45, depthWrite: false }));
    scene.add(new THREE.Points(starGeometry, starMaterial));

    const rect = canvas.getBoundingClientRect();
    resize(rect.width, rect.height);
    if (disposed) throw new Error("orbit_scene_unavailable");
    return {
      setPaused(value) {
        if (disposed) return;
        paused = value; cancelAnimationFrame(frame); frame = 0;
        if (!paused) { last = performance.now(); frame = requestAnimationFrame(tick); }
      }, resize, dispose,
    };
  } catch { dispose(); throw new Error("orbit_scene_unavailable"); }
}
