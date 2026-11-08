/**
 * Shared three.js stage for v4 calm models: renderer, void, studio sheen, floor, grid, low bloom,
 * resize, visibility, frame guard, titled labels, glass and full disposal.
 * A model only builds its own objects and supplies an `update(dt, elapsed)` callback.
 * Loaded on the client only; makes no network requests.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { FRAME_GUARD_START, V4, frameGuardStep } from "./theme";

export type StageOptions = {
  reducedMotion: boolean;
  frameGuard?: boolean;
  camera: { position: readonly [number, number, number]; target: readonly [number, number, number]; fov?: number; minDistance?: number; maxDistance?: number };
  onTooSlow(): void;
  /** Called with the root object (an ancestor carrying `userData.index`) of a clicked mesh. */
  onPick?(index: number): void;
};

export type Stage = {
  readonly three: typeof THREE;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  /** Register anything with dispose(); it is released with the stage. */
  keep<T extends { dispose(): void }>(x: T): T;
  /** Frosted glass in the v4 recipe. */
  glass(): THREE.MeshPhysicalMaterial;
  /** Titled label: optional mono prefix (e.g. "01") then the title, soft off-white, left-anchored. */
  label(text: string, prefix: string | null, worldHeight: number): THREE.Sprite;
  /** Objects whose descendants can be clicked; each root must set `userData.index`. */
  pickable: THREE.Object3D[];
  start(update: (dt: number, elapsed: number) => void): void;
  setVisible(visible: boolean): void;
  dispose(): void;
};

export function createStage(canvas: HTMLCanvasElement, options: StageOptions): Stage {
  const mobile = Math.min(canvas.clientWidth, canvas.clientHeight) < 500;
  const guard = options.frameGuard !== false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: "high-performance", failIfMajorPerformanceCaveat: guard });
  renderer.setPixelRatio(Math.min(mobile ? 1.5 : 2, window.devicePixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = V4.exposure;

  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(V4.color.void);
  scene.fog = new THREE.FogExp2(V4.color.void, V4.fogDensity);
  const pmrem = keep(new THREE.PMREMGenerator(renderer));
  scene.environment = keep(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
  scene.environmentIntensity = V4.environmentIntensity;

  const c = options.camera;
  const camera = new THREE.PerspectiveCamera(c.fov ?? 30, 1, 0.1, 200);
  camera.position.set(...c.position);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.enablePan = false;
  controls.minDistance = c.minDistance ?? 8; controls.maxDistance = c.maxDistance ?? 26; controls.maxPolarAngle = 1.4;
  controls.target.set(...c.target);

  const floor = new THREE.Mesh(keep(new THREE.CircleGeometry(24, 64)), keep(new THREE.MeshStandardMaterial({ color: V4.color.floor, roughness: 0.6, metalness: 0.3 })));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const grid = new THREE.GridHelper(36, 36, V4.color.gridMajor, V4.color.gridMinor);
  grid.position.y = 0.01; scene.add(grid); keep(grid.geometry); keep(grid.material as THREE.Material);

  const composer = keep(new EffectComposer(renderer));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), V4.bloom.strength, V4.bloom.radius, V4.bloom.threshold);
  composer.addPass(bloom); composer.addPass(new OutputPass());

  const glass = () => keep(new THREE.MeshPhysicalMaterial({
    color: V4.color.glass, roughness: V4.glass.roughness, transparent: true, opacity: V4.glass.opacity,
    clearcoat: 1, emissive: V4.color.glassEmissive, emissiveIntensity: V4.glass.emissiveIntensity, depthWrite: false,
  }));

  const label = (text: string, prefix: string | null, worldHeight: number) => {
    const el = document.createElement("canvas");
    el.width = 1024; el.height = 128;
    const ctx = el.getContext("2d");
    if (ctx) {
      let x = 12;
      if (prefix) { ctx.font = V4.font.mono; ctx.fillStyle = V4.text.prefix; ctx.fillText(prefix, x, 84); x += ctx.measureText(prefix).width + 22; }
      ctx.font = V4.font.sans; ctx.fillStyle = V4.text.title; ctx.fillText(text, x, 84);
    }
    const texture = new THREE.CanvasTexture(el);
    texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(worldHeight * 8, worldHeight, 1);
    sprite.center.set(0, 0.5);
    return sprite;
  };

  const pickable: THREE.Object3D[] = [];
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let down: [number, number] | null = null;
  const onDown = (e: PointerEvent) => { down = [e.clientX, e.clientY]; };
  const onUp = (e: PointerEvent) => {
    if (!options.onPick || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    let o: THREE.Object3D | null = ray.intersectObjects(pickable, true)[0]?.object ?? null;
    while (o && o.userData.index === undefined) o = o.parent;
    if (o) options.onPick(o.userData.index as number);
  };
  canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointerup", onUp);

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();

  const clock = new THREE.Clock();
  let frame = 0, visible = true, gaveUp = false, elapsed = 0, guardState = FRAME_GUARD_START;
  let update: (dt: number, elapsed: number) => void = () => {};
  const tick = () => {
    frame = requestAnimationFrame(tick);
    if (!visible || gaveUp) return;
    const raw = clock.getDelta(), dt = Math.min(raw, 0.05);
    elapsed += raw;
    if (guard) {
      const step = frameGuardStep(guardState, raw);
      guardState = step.state;
      if (step.tooSlow) { gaveUp = true; options.onTooSlow(); return; }
    }
    update(dt, elapsed);
    controls.update();
    composer.render();
  };

  return {
    three: THREE, scene, camera, controls, keep, glass, label, pickable,
    start(fn) { update = fn; frame = requestAnimationFrame(tick); },
    setVisible(next) { visible = next; if (next) clock.getDelta(); },
    dispose() {
      cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointerup", onUp);
      scene.traverse((o) => { const s = o as THREE.Sprite; if (s.isSprite) { s.material.map?.dispose(); s.material.dispose(); } });
      for (const d of disposables) d.dispose();
      renderer.dispose();
    },
  };
}
