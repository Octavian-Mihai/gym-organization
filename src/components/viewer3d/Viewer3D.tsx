"use client";
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges, Line, OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { primitiveExtent } from "@/lib/equipment/model";
import type { HoleSet, Material, Primitive } from "@/lib/equipment/types";
import { clearanceObb, dimsOf, modelOf, worldPlacement } from "@/lib/geometry/world";
import { rad } from "@/lib/geometry/rect";
import { snapMove } from "@/lib/geometry/snap";
import { validateSceneCached, type Issue } from "@/lib/geometry/validation";
import type { EquipmentInstance, Opening, Room, Scene, WallId } from "@/lib/scene/types";
import { useStore } from "@/lib/store/useStore";
import { formatLength } from "@/lib/units";

const MAT: Record<Material, { rough: number; metal: number }> = {
  steel: { rough: 0.45, metal: 0.6 }, chrome: { rough: 0.2, metal: 0.9 }, rubber: { rough: 0.95, metal: 0 }, plate: { rough: 0.5, metal: 0.3 },
  wood: { rough: 0.8, metal: 0 }, plastic: { rough: 0.6, metal: 0 }, glass: { rough: 0.05, metal: 0.1 }, fabric: { rough: 0.9, metal: 0 },
};

function PrimMesh({ p, selected, issue, wireframe }: { p: Primitive; selected: boolean; issue: boolean; wireframe: boolean }) {
  const e = primitiveExtent(p);
  const m = MAT[p.material ?? "steel"];
  const color = issue ? "#ef4444" : p.color ?? "#64748b";
  const mat = (
    <meshStandardMaterial color={color} roughness={m.rough} metalness={m.metal} wireframe={wireframe} transparent={p.material === "glass" || p.solid === false} opacity={p.material === "glass" ? 0.45 : p.solid === false ? 0.6 : 1} emissive={selected ? "#1d4ed8" : "#000000"} emissiveIntensity={selected ? 0.18 : 0} />
  );
  const pos: [number, number, number] = [p.center[0], p.center[2], p.center[1]];
  if (p.shape === "box") {
    return (
      <mesh position={pos} castShadow receiveShadow>
        <boxGeometry args={[e[0], e[2], e[1]]} />
        {mat}
        {p.role === "mat" && <Edges color="#52525b" lineWidth={1.5} />}
        {selected && <Edges color="#3b82f6" />}
      </mesh>
    );
  }
  const rot: [number, number, number] = p.axis === "x" ? [0, 0, Math.PI / 2] : p.axis === "y" ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  return (
    <mesh position={pos} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[p.size[0] / 2, p.size[0] / 2, p.size[2], 28]} />
      {mat}
      {p.role === "plate" && <Edges color="#00000055" threshold={30} />}
    </mesh>
  );
}

/** Visible adjustment holes drawn as instanced dark discs on host faces. */
function Holes({ h, wireframe }: { h: HoleSet; wireframe: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mats = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const xs = h.xs ?? [h.center[0]];
    const tmp = new THREE.Object3D();
    for (const side of [1, -1]) for (const x of xs) for (const z of h.zs) {
      if (h.axis === "x") {
        tmp.position.set(h.center[0] + side * (h.halfSize[0] + 0.4), z, h.center[1]);
        tmp.rotation.set(0, side * Math.PI / 2, 0);
      } else {
        tmp.position.set(x, z, h.center[1] + side * (h.halfSize[1] + 0.4));
        tmp.rotation.set(0, side === 1 ? 0 : Math.PI, 0);
      }
      tmp.updateMatrix();
      out.push(tmp.matrix.clone());
    }
    return out;
  }, [h]);
  useLayoutEffect(() => { mats.forEach((m, i) => ref.current?.setMatrixAt(i, m)); if (ref.current) ref.current.instanceMatrix.needsUpdate = true; }, [mats]);
  if (wireframe || mats.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, mats.length]} frustumCulled={false}>
      <circleGeometry args={[h.diameter / 2, 14]} />
      <meshBasicMaterial color="#05070a" />
    </instancedMesh>
  );
}

interface DragState { startPoint: THREE.Vector3; startScene: Scene; ids: string[]; moved: boolean }

const FLOOR = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const Equipment3D = memo(function Equipment3D({ inst, x, y, z, rot, selected, issue, wireframe, onDown, onMove, onUp }: {
  inst: EquipmentInstance; x: number; y: number; z: number; rot: number; selected: boolean; issue: boolean; wireframe: boolean;
  onDown: (e: ThreeEvent<PointerEvent>, id: string) => void; onMove: (e: ThreeEvent<PointerEvent>) => void; onUp: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const model = modelOf(inst);
  return (
    <group position={[x, z, y]} rotation={[0, -rad(rot), 0]} onPointerDown={(e) => onDown(e, inst.id)} onPointerMove={onMove} onPointerUp={onUp}
      onPointerOver={() => { document.body.style.cursor = inst.locked ? "not-allowed" : "grab"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
      {model.primitives.map((p) => <PrimMesh key={p.id} p={p} selected={selected} issue={issue} wireframe={wireframe} />)}
      {model.holes.map((h) => <Holes key={h.id} h={h} wireframe={wireframe} />)}
    </group>
  );
});

function wallShape(room: Room, wall: WallId): THREE.Shape {
  const wl = wall === "north" || wall === "south" ? room.length : room.width;
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(wl, 0); s.lineTo(wl, room.ceilingHeight); s.lineTo(0, room.ceilingHeight); s.closePath();
  for (const o of room.openings.filter((q) => q.wall === wall)) {
    const bottom = o.kind === "window" ? o.sillHeight : 0;
    const top = Math.min(room.ceilingHeight - 1, bottom + o.height);
    const a = Math.max(1, o.offset), b = Math.min(wl - 1, o.offset + o.width);
    if (b <= a) continue;
    const hole = new THREE.Path();
    hole.moveTo(a, bottom); hole.lineTo(b, bottom); hole.lineTo(b, top); hole.lineTo(a, top); hole.closePath();
    s.holes.push(hole);
  }
  return s;
}

const OUTWARD: Record<WallId, [number, number]> = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };

function Wall({ room, wall, vis }: { room: Room; wall: WallId; vis: "auto" | "visible" | "transparent" | "hidden" }) {
  const geo = useMemo(() => new THREE.ExtrudeGeometry(wallShape(room, wall), { depth: room.wallThickness, bevelEnabled: false }), [room, wall]);
  useEffect(() => () => geo.dispose(), [geo]);
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (!group.current) return;
    if (vis !== "auto") { group.current.visible = vis !== "hidden"; return; }
    // auto: hide walls that face the camera so the interior stays visible from any angle
    const [nx, nz] = OUTWARD[wall];
    const cx = room.length / 2, cz = room.width / 2;
    const facing = (camera.position.x - cx) * nx + (camera.position.z - cz) * nz > (nx ? room.length : room.width) / 2;
    group.current.visible = !facing;
  });
  const t = room.wallThickness;
  const transform = {
    north: { position: [0, 0, -t] as const, rotation: [0, 0, 0] as const },
    south: { position: [0, 0, room.width] as const, rotation: [0, 0, 0] as const },
    west: { position: [0, 0, 0] as const, rotation: [0, -Math.PI / 2, 0] as const },
    east: { position: [room.length + t, 0, 0] as const, rotation: [0, -Math.PI / 2, 0] as const },
  }[wall];
  return (
    <group ref={group}>
      <mesh geometry={geo} position={[...transform.position]} rotation={[...transform.rotation]} receiveShadow castShadow={vis !== "transparent"}>
        <meshStandardMaterial color={room.wallColors[wall]} roughness={0.9} transparent={vis === "transparent"} opacity={vis === "transparent" ? 0.18 : 1} depthWrite={vis !== "transparent"} side={THREE.DoubleSide} />
      </mesh>
      {room.openings.filter((o) => o.wall === wall).map((o) => <OpeningFill key={o.id} room={room} o={o} />)}
    </group>
  );
}

function OpeningFill({ room, o }: { room: Room; o: Opening }) {
  const bottom = o.kind === "window" ? o.sillHeight : 0;
  const mid = o.offset + o.width / 2;
  const t = room.wallThickness;
  const pos: Record<WallId, [number, number, number]> = {
    north: [mid, bottom + o.height / 2, -t / 2], south: [mid, bottom + o.height / 2, room.width + t / 2],
    west: [-t / 2, bottom + o.height / 2, mid], east: [room.length + t / 2, bottom + o.height / 2, mid],
  };
  const horiz = o.wall === "north" || o.wall === "south";
  return (
    <mesh position={pos[o.wall]}>
      <boxGeometry args={horiz ? [o.width, o.height, 20] : [20, o.height, o.width]} />
      <meshStandardMaterial color={o.kind === "window" ? "#7dd3fc" : "#b45309"} transparent opacity={o.kind === "window" ? 0.35 : 0.8} />
    </mesh>
  );
}

function CameraRig() {
  const preset = useStore((s) => s.cameraPreset);
  const ortho = useStore((s) => s.ortho);
  const room = useStore((s) => s.scene.room);
  const cam = useThree((s) => s.camera);
  const getState = useThree((s) => s.get);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  useEffect(() => {
    const { camera, size } = getState();
    const cx = room.length / 2, cz = room.width / 2, d = Math.max(room.length, room.width) * 1.5;
    const target = new THREE.Vector3(cx, room.ceilingHeight * 0.3, cz);
    const spots = {
      iso: [cx + d * 0.55, d * 0.8, cz + d * 0.9], top: [cx, d * 1.8, cz + 1], front: [cx, room.ceilingHeight * 0.5, cz + d * 1.4], side: [cx + d * 1.4, room.ceilingHeight * 0.5, cz],
    }[preset.preset] as [number, number, number];
    camera.position.set(...spots);
    camera.up.set(0, 1, 0);
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const oc = camera as THREE.OrthographicCamera;
      oc.zoom = Math.min(size.width, size.height) / (Math.max(room.length, room.width) * 1.25);
      oc.near = -50000; oc.far = 50000;
      oc.updateProjectionMatrix();
    } else { camera.near = 50; camera.far = 100000; (camera as THREE.PerspectiveCamera).updateProjectionMatrix(); }
    camera.lookAt(target);
    if (controls) { controls.target.copy(target); controls.update(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset.nonce, ortho, !!controls, cam]);
  return null;
}

function Scene3D({ issues }: { issues: Issue[] }) {
  const scene = useStore((s) => s.scene);
  const selection = useStore((s) => s.selection);
  const wallVis = useStore((s) => s.wallVis);
  const showCeiling = useStore((s) => s.showCeiling);
  const wireframe = useStore((s) => s.wireframe);
  const showClear = useStore((s) => s.settings.showClearances);
  const showDims = useStore((s) => s.settings.showDimensions);
  const ortho = useStore((s) => s.ortho);
  const orbit = useRef<OrbitControlsImpl>(null);
  const drag = useRef<DragState | null>(null);
  const { room } = scene;
  const issueIds = useMemo(() => new Set(issues.filter((i) => i.kind !== "clearance").flatMap((i) => i.objectIds)), [issues]);
  const st = useStore.getState;

  const floorPoint = (e: ThreeEvent<PointerEvent>) => { const v = new THREE.Vector3(); return e.ray.intersectPlane(FLOOR, v) ? v : null; };

  const onDown = (e: ThreeEvent<PointerEvent>, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const sel = st().selection;
    if (e.shiftKey) { st().select(sel.includes(id) ? sel.filter((i) => i !== id) : [id], !sel.includes(id) ? true : false); return; }
    if (!sel.includes(id)) st().select([id]);
    const ids = st().selection.filter((q) => { const i = st().scene.equipment.find((z) => z.id === q); return i && !i.locked && !i.parentId; });
    const p = floorPoint(e);
    if (!ids.length || !p) return;
    (e.target as unknown as Element).setPointerCapture?.(e.pointerId);
    st().beginGesture();
    drag.current = { startPoint: p, startScene: st().scene, ids, moved: false };
    if (orbit.current) orbit.current.enabled = false;
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d) return;
    const p = floorPoint(e);
    if (!p) return;
    let dx = p.x - d.startPoint.x, dy = p.z - d.startPoint.z;
    if (Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    const s = st().settings;
    const moving = d.ids.map((id) => d.startScene.equipment.find((q) => q.id === id)!);
    if (!e.altKey) { const r = snapMove(d.startScene, moving, dx, dy, { grid: s.gridSize, snapGrid: s.snapToGrid, snapWalls: s.snapToWalls, snapObjects: s.snapToObjects, threshold: 40 }); dx = r.dx; dy = r.dy; }
    st().transient(() => ({ ...d.startScene, equipment: d.startScene.equipment.map((q) => (d.ids.includes(q.id) ? { ...q, placement: { ...q.placement, x: q.placement.x + dx, y: q.placement.y + dy } } : q)) }));
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
    drag.current = null;
    st().endGesture();
    if (orbit.current) orbit.current.enabled = true;
  };

  const sel = selection.length === 1 ? scene.equipment.find((q) => q.id === selection[0]) : null;
  const selWp = sel ? worldPlacement(sel, scene) : null;
  const selDims = sel ? dimsOf(sel) : null;
  const big = Math.max(room.length, room.width);

  return (
    <>
      {ortho ? <OrthographicCamera makeDefault position={[room.length, big, room.width * 2]} zoom={0.15} /> : <PerspectiveCamera makeDefault fov={40} position={[room.length, big, room.width * 2]} near={50} far={100000} />}
      <OrbitControls ref={orbit} makeDefault enableDamping dampingFactor={0.15} maxPolarAngle={Math.PI / 2 + 0.3} />
      <CameraRig />
      <ambientLight intensity={0.7} />
      <hemisphereLight args={["#ffffff", "#8b9099", 0.5]} />
      <directionalLight position={[room.length * 0.3, room.ceilingHeight * 2.2, room.width * 0.2]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-big} shadow-camera-right={big} shadow-camera-top={big} shadow-camera-bottom={-big} shadow-camera-near={100} shadow-camera-far={room.ceilingHeight * 6} shadow-bias={-0.0005} />

      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[room.length / 2, -1, room.width / 2]} receiveShadow onPointerDown={() => { if (!st().selection.length) return; st().select([]); }}>
        <planeGeometry args={[room.length, room.width]} />
        <meshStandardMaterial color={room.floorColor} roughness={0.95} />
      </mesh>
      <gridHelper args={[Math.max(room.length, room.width), Math.round(Math.max(room.length, room.width) / 304.8), "#6b7280", "#9ca3af"]} position={[room.length / 2, 0.5, room.width / 2]} />
      {(["north", "east", "south", "west"] as WallId[]).map((w) => <Wall key={w} room={room} wall={w} vis={wallVis[w]} />)}
      {room.obstacles.map((ob) => {
        const horiz = ob.wall === "north" || ob.wall === "south";
        const mid = ob.offset + ob.width / 2;
        const pos: [number, number, number] = ob.wall === "north" ? [mid, ob.elevation + ob.height / 2, ob.depth / 2] : ob.wall === "south" ? [mid, ob.elevation + ob.height / 2, room.width - ob.depth / 2] : ob.wall === "west" ? [ob.depth / 2, ob.elevation + ob.height / 2, mid] : [room.length - ob.depth / 2, ob.elevation + ob.height / 2, mid];
        return <mesh key={ob.id} position={pos} castShadow><boxGeometry args={horiz ? [ob.width, ob.height, ob.depth] : [ob.depth, ob.height, ob.width]} /><meshStandardMaterial color="#f59e0b" /></mesh>;
      })}
      {showCeiling && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[room.length / 2, room.ceilingHeight, room.width / 2]}>
          <planeGeometry args={[room.length, room.width]} /><meshStandardMaterial color="#f3f4f6" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}

      {scene.equipment.map((e) => {
        if (e.hidden) return null;
        const wp = worldPlacement(e, scene);
        return <Equipment3D key={e.id} inst={e} x={wp.x} y={wp.y} z={wp.z} rot={wp.rotation} selected={selection.includes(e.id)} issue={issueIds.has(e.id)} wireframe={wireframe} onDown={onDown} onMove={onMove} onUp={onUp} />;
      })}

      {showClear && scene.equipment.map((e) => {
        if (e.hidden) return null;
        const c = clearanceObb(e, scene);
        if (!c) return null;
        return (
          <mesh key={`cl-${e.id}`} position={[c.cx, 3, c.cy]} rotation={[-Math.PI / 2, 0, -rad(c.rotation)]} raycast={() => null}>
            <planeGeometry args={[c.w, c.d]} />
            <meshBasicMaterial color={issues.some((i) => i.kind === "clearance" && i.objectIds[0] === e.id) ? "#ef4444" : "#f59e0b"} transparent opacity={0.28} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        );
      })}

      {/* dimension annotation outline for the selected object (text labels are DOM, see LabelOverlay) */}
      {showDims && sel && selWp && selDims && (
        <group position={[selWp.x, selWp.z, selWp.y]} rotation={[0, -rad(selWp.rotation), 0]}>
          <Line points={bboxLines(selDims)} color="#3b82f6" lineWidth={1.2} segments />
        </group>
      )}
    </>
  );
}

function bboxLines(d: { width: number; depth: number; height: number }): [number, number, number][] {
  const x = d.width / 2, z = d.depth / 2, h = d.height;
  const c = [[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z], [-x, h, -z], [x, h, -z], [x, h, z], [-x, h, z]] as [number, number, number][];
  const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  return edges.flatMap(([a, b]) => [c[a], c[b]]);
}

interface Label { id: string; pos: [number, number, number]; kind: "dim" | "sel" | "issue"; text: string; issue?: Issue }

/** Project world-space label anchors to screen space every frame and position plain DOM elements. */
function LabelProjector({ labels, els }: { labels: React.MutableRefObject<Label[]>; els: React.MutableRefObject<Map<string, HTMLElement>> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const l of labels.current) {
      const el = els.current.get(l.id);
      if (!el) continue;
      v.set(...l.pos).project(camera);
      if (v.z > 1 || v.z < -1) { el.style.display = "none"; continue; }
      el.style.display = "block";
      el.style.transform = `translate(${(v.x * 0.5 + 0.5) * size.width}px, ${(-v.y * 0.5 + 0.5) * size.height}px) translate(-50%, -50%)`;
    }
  });
  return null;
}

export function Viewer3D() {
  const scene = useStore((s) => s.scene);
  const selection = useStore((s) => s.selection);
  const unit = useStore((s) => s.settings.displayUnit);
  const showDims = useStore((s) => s.settings.showDimensions);
  const issues = useMemo(() => validateSceneCached(scene), [scene]);
  const labelsRef = useRef<Label[]>([]);
  const els = useRef(new Map<string, HTMLElement>());
  const { room } = scene;

  const labels = useMemo<Label[]>(() => {
    const out: Label[] = [];
    if (showDims) {
      out.push({ id: "L", pos: [room.length / 2, 5, room.width + 250], kind: "dim", text: formatLength(room.length, unit) });
      out.push({ id: "W", pos: [room.length + 250, 5, room.width / 2], kind: "dim", text: formatLength(room.width, unit) });
      out.push({ id: "H", pos: [0, room.ceilingHeight / 2, 0], kind: "dim", text: `↕ ${formatLength(room.ceilingHeight, unit)}` });
      const sel = selection.length === 1 ? scene.equipment.find((e) => e.id === selection[0]) : undefined;
      if (sel) {
        const wp = worldPlacement(sel, scene), d = dimsOf(sel);
        out.push({ id: "sel", pos: [wp.x, wp.z + d.height + 150, wp.y], kind: "sel", text: `${sel.name}: ${formatLength(d.width, unit)} W × ${formatLength(d.depth, unit)} D × ${formatLength(d.height, unit)} H` });
      }
    }
    for (const i of issues) if (i.at) out.push({ id: i.id, pos: [i.at.x, 60, i.at.y], kind: "issue", text: "!", issue: i });
    return out;
  }, [scene, selection, unit, showDims, issues, room]);
  useEffect(() => { labelsRef.current = labels; }, [labels]);

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-zinc-200 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950">
      <Canvas shadows dpr={[1, 2]} gl={{ preserveDrawingBuffer: true, antialias: true }}>
        <Scene3D issues={issues} />
        <LabelProjector labels={labelsRef} els={els} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {labels.map((l) => (
          <div key={l.id} ref={(el) => { if (el) els.current.set(l.id, el); else els.current.delete(l.id); }} className="absolute left-0 top-0" style={{ display: "none", zIndex: l.kind === "issue" ? 5 : 1 }}>
            {l.kind === "issue" ? (
              <button title={l.issue!.message} onClick={() => { useStore.getState().select(l.issue!.objectIds); useStore.getState().setFocusIssue(l.issue!.id); }} className={`pointer-events-auto h-5 w-5 rounded-full border border-white text-[11px] font-bold leading-none text-white shadow ${l.issue!.severity === "error" ? "bg-red-500" : "bg-amber-500"}`}>!</button>
            ) : (
              <div className={`whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[11px] shadow ${l.kind === "sel" ? "bg-blue-600 text-white" : "bg-white/90 text-zinc-800"}`}>{l.text}</div>
            )}
          </div>
        ))}
      </div>
      <ViewControls3D />
      <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-white/80 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-400">Drag objects to move · Left-drag background orbit · Right-drag pan · Wheel zoom · {scene.equipment.length} objects</div>
    </div>
  );
}

function ViewControls3D() {
  const s = useStore();
  const btn = "rounded px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800";
  const walls: WallId[] = ["north", "east", "south", "west"];
  return (
    <div className="absolute right-3 top-3 flex max-w-[260px] flex-col gap-2 rounded-md border border-zinc-300 bg-white/90 p-2 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90">
      <div className="flex flex-wrap gap-1">
        {(["iso", "top", "front", "side"] as const).map((p) => <button key={p} className={`${btn} border border-zinc-200 dark:border-zinc-700`} onClick={() => s.setCameraPreset(p)}>{p === "iso" ? "Isometric" : p[0].toUpperCase() + p.slice(1)}</button>)}
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-1"><input type="checkbox" checked={s.ortho} onChange={(e) => s.set3d({ ortho: e.target.checked })} />Orthographic</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={s.showCeiling} onChange={(e) => s.set3d({ showCeiling: e.target.checked })} />Ceiling</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={s.wireframe} onChange={(e) => s.set3d({ wireframe: e.target.checked })} />Wireframe</label>
      </div>
      <div className="space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Walls</div>
        {walls.map((w) => (
          <div key={w} className="flex items-center justify-between gap-2">
            <span className="w-12 capitalize">{w}</span>
            <select className="rounded border border-zinc-300 bg-transparent px-1 dark:border-zinc-700" value={s.wallVis[w]} onChange={(e) => s.setWallVis(w, e.target.value as "auto" | "visible" | "transparent" | "hidden")}>
              <option value="auto">Auto (hide facing)</option><option value="visible">Visible</option><option value="transparent">Transparent</option><option value="hidden">Hidden</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
