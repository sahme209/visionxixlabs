/**
 * Imperative three.js scene for the homepage governed-deployment model (visual language v4).
 * Loaded only on the client, only when WebGL is available and the section is near view.
 * No network requests: every material, light and label is generated in code.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { FLOW_EXTERNAL_SYSTEMS, FLOW_STATIONS, flowStationState, type FlowScenario, type FlowStationState } from "@/lib/marketing/governedFlowModel";

export type GovernedSceneHandle = {
  setScenario(scenario: FlowScenario): void;
  setPlaying(playing: boolean): void;
  setVisible(visible: boolean): void;
  select(index: number): void;
  overview(): void;
  dispose(): void;
};

export type GovernedSceneOptions = {
  reducedMotion: boolean;
  onReached(index: number): void;
  onSelect(index: number): void;
  /** Called once if frames stay over budget; the caller should switch to the 2D view. */
  onTooSlow(): void;
};

const ACCENT = 0x6fc3ff;
const STATE_COLOR: Record<FlowStationState, number> = {
  passed: 0x6ff2c0, current: 0xffffff, pending: ACCENT, blocked: 0xff5468, warning: 0xffb347, unreached: 0x26303e,
};
const STATION_POS: readonly (readonly [number, number])[] = [
  [-11, -1.2], [-4, -1.6], [-0.8, -1.6], [2.6, -1.6], [9, -1.8], [11.9, -1.8], [13.9, 1.5], [2.6, 2.3],
];
const OVERVIEW = { target: new THREE.Vector3(1, 1, 0), camera: new THREE.Vector3(2, 12, 25) };

function label(text: string, height: number, color: string, font: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = "center"; ctx.fillText(text, 512, 86); }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(height * 8, height, 1);
  return sprite;
}

export function createGovernedScene(canvas: HTMLCanvasElement, options: GovernedSceneOptions): GovernedSceneHandle {
  const mobile = Math.min(canvas.clientWidth, canvas.clientHeight) < 500;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: "high-performance", failIfMajorPerformanceCaveat: true });
  renderer.setPixelRatio(Math.min(mobile ? 1.5 : 2, window.devicePixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03050a);
  scene.fog = new THREE.FogExp2(0x03050a, 0.03);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  camera.position.copy(OVERVIEW.camera);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = 1.32; controls.minDistance = 7; controls.maxDistance = 40;
  controls.target.copy(OVERVIEW.target);

  const disposables: { dispose(): void }[] = [renderer, pmrem, envTexture, controls];
  const track = <T extends { dispose(): void }>(item: T): T => { disposables.push(item); return item; };
  const glass = () => track(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, transmission: 1, thickness: 1.2, ior: 1.4, transparent: true, opacity: 0.85, clearcoat: 1 }));
  const lineMat = (color: number, opacity = 0.95) => track(new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  const edged = (geometry: THREE.BufferGeometry, color = ACCENT) => {
    track(geometry);
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, glass()));
    const edge = new THREE.LineSegments(track(new THREE.EdgesGeometry(geometry, 25)), lineMat(color));
    group.add(edge);
    return { group, edge };
  };

  const floor = new THREE.Mesh(track(new THREE.CircleGeometry(44, 96)), track(new THREE.MeshStandardMaterial({ color: 0x05080e, roughness: 0.12, metalness: 0.85 })));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const gridMaterial = track(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { t: { value: 0 } },
    vertexShader: "varying vec2 v;void main(){v=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "varying vec2 v;uniform float t;void main(){vec2 g=abs(fract(v)-.5);float l=step(.485,max(g.x,g.y));float r=length(v);float w=smoothstep(.0,.6,1.-abs(fract(r*.12-t*.15)-.5)*2.)*.35;float f=exp(-r*.06);gl_FragColor=vec4(vec3(.25,.55,.9),(l*.18+l*w)*f);}",
  }));
  const grid = new THREE.Mesh(track(new THREE.PlaneGeometry(88, 88).rotateX(-Math.PI / 2)), gridMaterial);
  grid.position.y = 0.02; scene.add(grid);

  ([[-11, 6.5, "YOUR SOURCE"], [0, 12.5, "AXIOM CONTROL PLANE"], [11.6, 7.6, "YOUR CLOUD"]] as const).forEach(([x, w, text], i) => {
    const zone = edged(new RoundedBoxGeometry(w, 0.08, 7.6, 2, 0.04), i === 1 ? ACCENT : 0x4c6585);
    zone.group.position.set(x, 0.05, 0); (zone.group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>).material.opacity = 0.3;
    scene.add(zone.group);
    const tag = label(text, 0.4, "#6f8bab", "400 52px monospace"); tag.position.set(x, 0.2, 4.3); scene.add(tag);
  });
  [-7.8, 7.8].forEach((x) => {
    const wall = new THREE.Mesh(track(new THREE.PlaneGeometry(7.6, 3)), track(new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false })));
    wall.rotation.y = Math.PI / 2; wall.position.set(x, 1.5, 0); scene.add(wall);
    const tag = label("TRUST BOUNDARY", 0.28, "#4f7aa6", "400 52px monospace"); tag.position.set(x, 3.25, 0); scene.add(tag);
  });

  const shapes: THREE.BufferGeometry[] = [
    new RoundedBoxGeometry(1.1, 1.6, 1.1, 4, 0.18), new THREE.IcosahedronGeometry(0.75, 1), new THREE.TorusGeometry(0.8, 0.05, 12, 72),
    new RoundedBoxGeometry(0.2, 1.8, 0.2, 2, 0.08), new THREE.OctahedronGeometry(0.7, 0), new RoundedBoxGeometry(2.2, 1.6, 0.8, 4, 0.14),
    new THREE.CylinderGeometry(0.4, 0.4, 1.6, 48, 1, true), new THREE.CylinderGeometry(0.9, 0.9, 1.1, 64),
  ];
  const baseY = (i: number) => (i === 2 ? 1.1 : i === 3 ? 0.9 : 1);
  const stations = FLOW_STATIONS.map((station, i) => {
    const root = new THREE.Group(); root.position.set(STATION_POS[i][0], 0, STATION_POS[i][1]); root.userData.index = i;
    const body = edged(shapes[i]); body.group.position.y = baseY(i);
    if (i === 2) body.group.rotation.y = Math.PI / 2;
    if (i === 3) body.group.position.x = -1.1;
    root.add(body.group);
    const ring = new THREE.Mesh(track(new THREE.RingGeometry(1.0, 1.03, 96)), track(new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.4 })));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; root.add(ring);
    const orbit = new THREE.LineSegments(track(new THREE.EdgesGeometry(track(new THREE.RingGeometry(1.25, 1.25, 48, 1, 0, Math.PI * 1.4)))), lineMat(ACCENT, 0.5));
    orbit.rotation.x = -Math.PI / 2; orbit.position.y = 0.04; root.add(orbit);
    const tag = label(station.name, 0.34, "#cfe0f2", "300 60px sans-serif"); tag.position.set(0, 2.5, 0); root.add(tag);
    scene.add(root);
    return { root, body, ring, orbit };
  });
  const secondPost = edged(new RoundedBoxGeometry(0.2, 1.8, 0.2, 2, 0.08)); secondPost.group.position.set(1.1, 0.9, 0); stations[3].root.add(secondPost.group);
  const barrierMaterial = track(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { c: { value: new THREE.Color(STATE_COLOR.blocked) }, a: { value: 0.55 }, t: { value: 0 } },
    vertexShader: "varying vec2 u;void main(){u=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "varying vec2 u;uniform vec3 c;uniform float a,t;void main(){float s=step(.5,fract(u.y*18.-t*2.));gl_FragColor=vec4(c,a*(.25+.5*s));}",
  }));
  const barrier = new THREE.Mesh(track(new THREE.PlaneGeometry(2.2, 1.5)), barrierMaterial); barrier.position.set(0, 0.95, 0); stations[3].root.add(barrier);

  const EXTERNAL_POS: readonly (readonly [number, number, number])[] = [[-11, 4.6, -4.5], [-4, 4.8, -5], [-0.8, 4.4, -5.4], [3.2, 4.8, -5.2], [5.8, 3.6, -4.4], [9, 4.6, -5], [12.6, 4.4, -4.6]];
  const flows = FLOW_EXTERNAL_SYSTEMS.map((system, i) => {
    const node = edged(new THREE.OctahedronGeometry(0.28, 0), 0x9fb7d6); node.group.position.set(...EXTERNAL_POS[i]); scene.add(node.group);
    const tag = label(system.name, 0.26, "#9fb7d6", "400 50px monospace"); tag.position.set(EXTERNAL_POS[i][0], EXTERNAL_POS[i][1] + 0.6, EXTERNAL_POS[i][2]); scene.add(tag);
    const to = FLOW_STATIONS.findIndex((s) => s.id === system.station);
    const a = new THREE.Vector3(...EXTERNAL_POS[i]); const b = stations[to].root.position.clone().setY(1.6);
    const curve = new THREE.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).setY(Math.max(a.y, b.y) + 0.6), b);
    const line = new THREE.Line(track(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40))), track(new THREE.LineDashedMaterial({ color: 0x22405f, dashSize: 0.15, gapSize: 0.12, transparent: true, opacity: 0.8 })));
    line.computeLineDistances(); scene.add(line);
    const dots = new THREE.Points(track(new THREE.BufferGeometry().setFromPoints([0, 1, 2].map(() => new THREE.Vector3()))), track(new THREE.PointsMaterial({ color: ACCENT, size: 0.12, transparent: true })));
    scene.add(dots);
    return { curve, line, dots, to };
  });

  const holoCanvas = document.createElement("canvas"); holoCanvas.width = 512; holoCanvas.height = 256;
  const holoTexture = track(new THREE.CanvasTexture(holoCanvas)); holoTexture.colorSpace = THREE.SRGBColorSpace;
  const holo = new THREE.Mesh(track(new THREE.PlaneGeometry(3.2, 1.6)), track(new THREE.MeshBasicMaterial({ map: holoTexture, transparent: true, depthWrite: false, side: THREE.DoubleSide })));
  scene.add(holo);
  const drawHolo = (i: number) => {
    const ctx = holoCanvas.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, 512, 256); ctx.fillStyle = "rgba(20,60,110,0.35)"; ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = "#6fc3ff"; ctx.lineWidth = 3; ctx.strokeRect(2, 2, 508, 252);
    ctx.fillStyle = "#6fc3ff"; ctx.font = "500 26px monospace"; ctx.fillText(FLOW_STATIONS[i].name.toUpperCase(), 20, 40);
    ctx.fillStyle = "#d6e6f7"; ctx.font = "400 24px monospace";
    FLOW_STATIONS[i].readout.forEach((line, j) => ctx.fillText(line, 20, 90 + j * 40));
    holoTexture.needsUpdate = true;
  };

  const railPoints = [[-11, 1, -0.1], [-4, 1, -0.5], [-0.8, 1.1, -0.5], [2.6, 1, -0.5], [9, 1, -0.7], [11.9, 1, -0.6], [13.9, 1, 0.4], [2.6, 1, 1.3]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const path = new THREE.CatmullRomCurve3(railPoints);
  scene.add(new THREE.Mesh(track(new THREE.TubeGeometry(path, 260, 0.012, 6, false)), track(new THREE.MeshBasicMaterial({ color: 0x2b4d72 }))));
  const pulseMaterial = track(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const pulse = new THREE.Mesh(track(new THREE.SphereGeometry(0.16, 32, 16)), pulseMaterial); scene.add(pulse);
  const pulseLight = new THREE.PointLight(ACCENT, 8, 5); pulse.add(pulseLight);
  const TRAIL = 50;
  const trail = new THREE.Points(track(new THREE.BufferGeometry().setFromPoints(Array.from({ length: TRAIL }, () => new THREE.Vector3()))), track(new THREE.PointsMaterial({ color: ACCENT, size: 0.08, transparent: true, opacity: 0.7 })));
  scene.add(trail);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.95, 0.55, 0.12); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  disposables.push(composer, bloom);

  let scenario: FlowScenario | null = null;
  let progress = 0, reached = -1, playing = !options.reducedMotion, visible = true, selected = 3;
  let fly: { target: THREE.Vector3; camera: THREE.Vector3 } | null = null;
  const history: THREE.Vector3[] = [];

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();

  const flyTo = (target: THREE.Vector3, cam: THREE.Vector3) => {
    if (options.reducedMotion) { controls.target.copy(target); camera.position.copy(cam); }
    else fly = { target, camera: cam };
  };

  const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let down: [number, number] | null = null;
  const onDown = (e: PointerEvent) => { down = [e.clientX, e.clientY]; };
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(stations.map((s) => s.root), true).find((h) => (h.object as THREE.Mesh).isMesh);
    let obj: THREE.Object3D | null = hit?.object ?? null;
    while (obj && obj.userData.index === undefined) obj = obj.parent;
    if (obj) options.onSelect(obj.userData.index as number);
  };
  canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointerup", onUp);

  const clock = new THREE.Clock();
  let frame = 0;
  // Frame-budget guard: after a short warm-up, sustained frames over ~45 ms hand control back to 2D.
  let sampled = 0, slow = 0, gaveUp = false;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    if (!visible || document.hidden || !scenario) return;
    const raw = clock.getDelta(), dt = Math.min(raw, 0.05), elapsed = clock.elapsedTime;
    if (!gaveUp && elapsed > 1.5 && sampled < 90) {
      sampled += 1; if (raw > 0.045) slow += 1;
      if (sampled >= 45 && slow / sampled > 0.6) { gaveUp = true; options.onTooSlow(); return; }
    }
    const last = FLOW_STATIONS.length - 1, end = scenario.stop / last;
    if (playing) { progress += dt * 0.055; if (progress > end + 0.3) { progress = 0; history.length = 0; } }
    const p = Math.min(progress, end), k = Math.floor(p * last + 0.001), atEnd = p >= end - 1e-4;
    if (k !== reached) { reached = k; options.onReached(k); }

    const point = path.getPoint(p); pulse.position.copy(point);
    const pulseColor = atEnd && scenario.blockedAt !== undefined ? STATE_COLOR.blocked : atEnd && scenario.warningAt !== undefined ? STATE_COLOR.warning : 0xffffff;
    pulseMaterial.color.setHex(pulseColor); pulseLight.color.setHex(pulseColor === 0xffffff ? ACCENT : pulseColor);
    history.unshift(point.clone()); if (history.length > TRAIL) history.pop();
    const trailPos = trail.geometry.attributes.position as THREE.BufferAttribute;
    for (let j = 0; j < TRAIL; j++) { const v = history[j] ?? point; trailPos.setXYZ(j, v.x, v.y, v.z); }
    trailPos.needsUpdate = true;

    stations.forEach((s, i) => {
      const color = STATE_COLOR[flowStationState(scenario as FlowScenario, i, k)];
      (s.body.edge.material as THREE.LineBasicMaterial).color.setHex(color);
      (s.ring.material as THREE.MeshBasicMaterial).color.setHex(color);
      (s.ring.material as THREE.MeshBasicMaterial).opacity = i === k ? 0.9 : 0.3;
      (s.orbit.material as THREE.LineBasicMaterial).color.setHex(color);
      if (!options.reducedMotion) {
        s.orbit.rotation.z += dt * (i === k ? 1.2 : 0.25);
        s.body.group.position.y = baseY(i) + Math.sin(elapsed * 1.2 + i) * 0.05 + (i === selected ? 0.22 : 0);
        if (i === 1 || i === 4) s.body.group.rotation.y += dt * 0.45;
      }
    });
    (secondPost.edge.material as THREE.LineBasicMaterial).color.setHex(STATE_COLOR[flowStationState(scenario, 3, k)]);
    const open = scenario.stop > 3 && k >= 3;
    barrierMaterial.uniforms.c.value.setHex(open ? STATE_COLOR.passed : STATE_COLOR.blocked);
    barrierMaterial.uniforms.a.value += ((open ? 0 : 0.55) - barrierMaterial.uniforms.a.value) * Math.min(1, dt * 3);
    barrierMaterial.uniforms.t.value = elapsed;

    flows.forEach((f) => {
      const active = f.to === k;
      (f.line.material as THREE.LineDashedMaterial).color.setHex(active ? ACCENT : 0x22405f);
      f.dots.visible = active && !options.reducedMotion;
      if (f.dots.visible) {
        const pos = f.dots.geometry.attributes.position as THREE.BufferAttribute;
        for (let j = 0; j < 3; j++) { const q = f.curve.getPoint((elapsed * 0.6 + j / 3) % 1); pos.setXYZ(j, q.x, q.y, q.z); }
        pos.needsUpdate = true;
      }
    });
    holo.quaternion.copy(camera.quaternion);
    gridMaterial.uniforms.t.value = elapsed;
    if (fly) { controls.target.lerp(fly.target, 0.06); camera.position.lerp(fly.camera, 0.06); if (camera.position.distanceTo(fly.camera) < 0.05) fly = null; }
    controls.update();
    composer.render();
  };
  frame = requestAnimationFrame(tick);

  const handle: GovernedSceneHandle = {
    setScenario(next) { scenario = next; progress = options.reducedMotion ? next.stop / (FLOW_STATIONS.length - 1) : 0; reached = -1; history.length = 0; },
    setPlaying(next) { playing = next && !options.reducedMotion; },
    setVisible(next) { visible = next; if (next) clock.getDelta(); },
    select(index) {
      selected = index; drawHolo(index);
      const root = stations[index].root.position;
      holo.position.set(root.x, 4.1, root.z + 0.2);
      flyTo(new THREE.Vector3(root.x, 1.8, root.z), new THREE.Vector3(root.x + 3, 4.6, root.z + 7));
    },
    overview() { flyTo(OVERVIEW.target.clone(), OVERVIEW.camera.clone()); },
    dispose() {
      cancelAnimationFrame(frame); observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointerup", onUp);
      scene.traverse((o) => { const s = o as THREE.Sprite; if (s.isSprite) { s.material.map?.dispose(); s.material.dispose(); } });
      for (const d of disposables) d.dispose();
    },
  };
  drawHolo(selected);
  const start = stations[selected].root.position;
  holo.position.set(start.x, 4.1, start.z + 0.2);
  return handle;
}
