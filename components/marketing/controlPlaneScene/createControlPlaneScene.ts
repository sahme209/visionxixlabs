/**
 * Product page control-plane model (visual language v4, calm), built on the shared visual kit.
 * Five frosted layers stacked vertically; one slow light pulse travels top to bottom.
 * Every layer and every part carries a readable title.
 */
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { CONTROL_PLANE_LAYERS, layerNumber, pulseLayer } from "@/lib/marketing/controlPlaneModel";
import { createStage } from "../visualKit/stage";
import { V4 } from "../visualKit/theme";

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

export function createControlPlaneScene(canvas: HTMLCanvasElement, options: ControlPlaneSceneOptions): ControlPlaneSceneHandle {
  const stage = createStage(canvas, {
    reducedMotion: options.reducedMotion,
    frameGuard: options.frameGuard,
    camera: { position: [10, 7.5, 12.5], target: [0.8, 2.4, 0], minDistance: 9, maxDistance: 24 },
    onTooSlow: options.onTooSlow,
    onPick: options.onSelect,
  });
  const THREE = stage.three;
  const { keep, glass, label, scene } = stage;

  const slabGeo = keep(new RoundedBoxGeometry(5.4, 0.3, 3.6, 4, 0.12));
  const slabEdges = keep(new THREE.EdgesGeometry(slabGeo, 25));
  const partGeo = keep(new RoundedBoxGeometry(1.45, 0.2, 1.0, 3, 0.08));
  const partEdges = keep(new THREE.EdgesGeometry(partGeo, 25));

  const layers = CONTROL_PLANE_LAYERS.map((layer, i) => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(slabGeo, glass()));
    const edgeMat = keep(new THREE.LineBasicMaterial({ color: V4.color.accent, transparent: true, opacity: 0.6 }));
    group.add(new THREE.LineSegments(slabEdges, edgeMat));
    layer.parts.forEach((part, j) => {
      const x = -1.75 + j * 1.75;
      const block = new THREE.Mesh(partGeo, glass()); block.position.set(x, 0.25, 0.2); group.add(block);
      const pe = new THREE.LineSegments(partEdges, keep(new THREE.LineBasicMaterial({ color: V4.color.partEdge, transparent: true, opacity: 0.45 })));
      pe.position.copy(block.position); group.add(pe);
      const t = label(part.title, null, 0.26); t.position.set(x - 0.68, 0.32, 1.05); group.add(t);
    });
    const title = label(layer.title, layerNumber(i), 0.42); title.position.set(3.0, 0.05, 0); group.add(title);
    group.userData = { index: i };
    scene.add(group); stage.pickable.push(group);
    return { group, edgeMat };
  });

  const beam = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.015, 0.015, 1, 8)), keep(new THREE.MeshBasicMaterial({ color: V4.color.accent, transparent: true, opacity: 0.28 })));
  beam.position.x = -2.9; scene.add(beam);
  const pulse = new THREE.Mesh(keep(new THREE.SphereGeometry(0.11, 24, 16)), keep(new THREE.MeshBasicMaterial({ color: 0xffffff })));
  pulse.position.x = -2.9; pulse.add(new THREE.PointLight(V4.color.accent, 3, 2.5)); scene.add(pulse);

  let selected = 2, exploded = true, playing = !options.reducedMotion, progress = options.reducedMotion ? 0.999 : 0;
  const gap = () => (exploded ? 1.15 : 0.4);
  const topY = () => 0.45 + gap() * (layers.length - 1);
  layers.forEach((l, i) => { l.group.position.y = topY() - i * gap(); });

  stage.start((dt) => {
    if (playing) progress = (progress + dt * V4.motion.pulsePerSecond) % 1;
    const k = pulseLayer(progress);
    layers.forEach((l, i) => {
      const y = topY() - i * gap();
      l.group.position.y += (y - l.group.position.y) * Math.min(1, dt * V4.motion.settlePerSecond);
      l.edgeMat.color.setHex(i === selected ? V4.color.selected : i < k ? V4.color.passed : V4.color.accent);
      l.edgeMat.opacity = i === selected ? 0.95 : 0.55;
    });
    const yTop = topY() + 0.7, yBottom = 0.25;
    beam.scale.y = yTop - yBottom; beam.position.y = (yTop + yBottom) / 2;
    pulse.position.y = yTop - (yTop - yBottom) * progress;
  });

  return {
    select(index) { selected = index; },
    setExploded(next) { exploded = next; },
    setPlaying(next) { playing = next && !options.reducedMotion; },
    setVisible: stage.setVisible,
    dispose: stage.dispose,
  };
}
