/**
 * Imperative three.js scene for the Product page control-plane model (visual language v4, calm).
 * Five frosted layers stacked vertically; one slow light pulse travels top to bottom.
 * Every layer and every part carries a readable title (Inter, regular weight, soft white).
 * No network requests: materials and labels are generated in code.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { CONTROL_PLANE_LAYERS, layerNumber, pulseLayer } from "@/lib/marketing/controlPlaneModel";

export type ControlPlaneSceneHandle = {
  select(index: number): void;
  setExploded(exploded: boolean): void;
  setPlaying(playing: boolean): void;
  setVisible(visible: boolean): void;
  dispose(): void;
};

export type ControlPlaneSceneOptions = {
  reducedMotion: boolean;
  frameGuard?: boolean;
  onSelect(index: number): void;
  onTooSlow(): void;
};

const ACCENT = 0x7cc4f5;
const PASSED = 0x8fe3c6;
const SELECTED = 0xf2f6fb;
const FONT = '400 52px Inter, "SF Pro Text", -apple-system, system-ui, sans-serif';
const MONO = '400 40px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

/** Soft, eye-friendly label: off-white text, no glow, generous canvas so glyphs stay crisp. */
function label(text: string, prefix: string | null, worldHeight: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    let x = 12;
    if (prefix) { ctx.font = MONO; ctx.fillStyle = "#7f93ab"; ctx.fillText(prefix, x, 84); x += ctx.measureText(prefix).width + 22; }
    ctx.font = FONT; ctx.fillStyle = "#dde6f0"; ctx.fillText(text, x, 84);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(worldHeight * 8, worldHeight, 1);
  sprite.center.set(0, 0.5);
  return sprite;
}

export function createControlPlaneScene(canvas: HTMLCanvasElement, options: ControlPlaneSceneOptions): ControlPlaneSceneHandle {
  const mobile = Math.min(canvas.clientWidth, canvas.clientHeight) < 500;
  const guard = options.frameGuard !== false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: "high-performance", failIfMajorPerformanceCaveat: guard });
  renderer.setPixelRatio(Math.min(mobile ? 1.5 : 2, window.devicePixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;

  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03050a);
  scene.fog = new THREE.FogExp2(0x03050a, 0.03);
  const pmrem = keep(new THREE.PMREMGenerator(renderer));
  scene.environment = keep(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
  scene.environmentIntensity = 0.3;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(10, 7.5, 12.5);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.enablePan = false;
  controls.minDistance = 9; controls.maxDistance = 24; controls.maxPolarAngle = 1.4;
  controls.target.set(0.8, 2.4, 0);

  const glass = () => keep(new THREE.MeshPhysicalMaterial({ color: 0x9cc6ec, roughness: 0.2, transparent: true, opacity: 0.14, clearcoat: 1, emissive: 0x1d4f7c, emissiveIntensity: 0.35, depthWrite: false }));

  const floor = new THREE.Mesh(keep(new THREE.CircleGeometry(20, 64)), keep(new THREE.MeshStandardMaterial({ color: 0x05080e, roughness: 0.6, metalness: 0.3 })));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const grid = new THREE.GridHelper(30, 30, 0x132235, 0x0c1622); grid.position.y = 0.01; scene.add(grid);
  keep(grid.geometry); keep(grid.material as THREE.Material);

  const slabGeo = keep(new RoundedBoxGeometry(5.4, 0.3, 3.6, 4, 0.12));
  const slabEdges = keep(new THREE.EdgesGeometry(slabGeo, 25));
  const partGeo = keep(new RoundedBoxGeometry(1.45, 0.2, 1.0, 3, 0.08));
  const partEdges = keep(new THREE.EdgesGeometry(partGeo, 25));

  const layers = CONTROL_PLANE_LAYERS.map((layer, i) => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(slabGeo, glass()));
    const edgeMat = keep(new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.6 }));
    group.add(new THREE.LineSegments(slabEdges, edgeMat));
    layer.parts.forEach((part, j) => {
      const x = -1.75 + j * 1.75;
      const block = new THREE.Mesh(partGeo, glass()); block.position.set(x, 0.25, 0.2); group.add(block);
      const pe = new THREE.LineSegments(partEdges, keep(new THREE.LineBasicMaterial({ color: 0xa9bdd6, transparent: true, opacity: 0.45 })));
      pe.position.copy(block.position); group.add(pe);
      // Title for each part, lying just in front of its block so it reads from the default view.
      const t = label(part.title, null, 0.26); t.position.set(x - 0.68, 0.32, 1.05); group.add(t);
    });
    const title = label(layer.title, layerNumber(i), 0.42); title.position.set(3.0, 0.05, 0); group.add(title);
    group.userData = { index: i };
    scene.add(group);
    return { group, edgeMat };
  });

  const beamMat = keep(new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.28 }));
  const beam = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.015, 0.015, 1, 8)), beamMat);
  beam.position.x = -2.9; scene.add(beam);
  const pulse = new THREE.Mesh(keep(new THREE.SphereGeometry(0.11, 24, 16)), keep(new THREE.MeshBasicMaterial({ color: 0xffffff })));
  pulse.position.x = -2.9;
  pulse.add(new THREE.PointLight(ACCENT, 3, 2.5));
  scene.add(pulse);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // Low-strength bloom keeps edges luminous without halos (calm, not flashy).
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.45, 0.4);
  composer.addPass(bloom); composer.addPass(new OutputPass());
  keep(composer);

  let selected = 2, exploded = true, playing = !options.reducedMotion, visible = true, progress = options.reducedMotion ? 0.999 : 0;
  const gap = () => (exploded ? 1.15 : 0.4);
  const topY = () => 0.45 + gap() * (layers.length - 1);
  layers.forEach((l, i) => { l.group.position.y = topY() - i * gap(); });

  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let down: [number, number] | null = null;
  const onDown = (e: PointerEvent) => { down = [e.clientX, e.clientY]; };
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(layers.map((l) => l.group), true)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && o.userData.index === undefined) o = o.parent;
    if (o) options.onSelect(o.userData.index as number);
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
  let frame = 0, sampled = 0, slow = 0, elapsed = 0, gaveUp = false;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    if (!visible || gaveUp) return;
    const raw = clock.getDelta(), dt = Math.min(raw, 0.05);
    elapsed += raw;
    if (guard) {
      if (raw > 0.4 && sampled > 2) { gaveUp = true; options.onTooSlow(); return; }
      if (elapsed > 1) { sampled += 1; slow += raw; if (sampled >= 10 && slow / sampled > 0.06) { gaveUp = true; options.onTooSlow(); return; } }
      else sampled = sampled < 2 ? sampled + 1 : sampled;
    }
    // Slow, steady pulse: one full pass every ~9 seconds.
    if (playing) progress = (progress + dt * 0.11) % 1;
    const k = pulseLayer(progress);
    layers.forEach((l, i) => {
      const y = topY() - i * gap();
      l.group.position.y += (y - l.group.position.y) * Math.min(1, dt * 3);
      l.edgeMat.color.setHex(i === selected ? SELECTED : i < k ? PASSED : ACCENT);
      l.edgeMat.opacity = i === selected ? 0.95 : 0.55;
    });
    const yTop = topY() + 0.7, yBottom = 0.25;
    beam.scale.y = yTop - yBottom; beam.position.y = (yTop + yBottom) / 2;
    pulse.position.y = yTop - (yTop - yBottom) * progress;
    controls.update();
    composer.render();
  };
  frame = requestAnimationFrame(tick);

  return {
    select(index) { selected = index; },
    setExploded(next) { exploded = next; },
    setPlaying(next) { playing = next && !options.reducedMotion; },
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
