# Home Gym Designer

A local-first, browser-based planner for a home gym: define the room, build equipment from real dimensions, arrange it in a precise 2D floor plan, and inspect the same design in 3D. No backend, no accounts, no paid services.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest (geometry, units, persistence, store, components)
npm run typecheck
npm run build
```

## What's in the MVP

- **Room**: length / width / ceiling / wall thickness, floor + wall colors, doors (swing direction), windows (sill height), wall obstacles. Resizing the room never removes equipment; items that no longer fit are flagged.
- **Units**: display in mm, cm, m, in, ft. Everything is stored in **millimeters**; fields accept mixed input such as `36`, `36 in`, `5' 6"`, `915mm`, `1.2 m`.
- **Equipment** (registry-driven, extensible): parametric power rack (4/6-post, upright profile, hole diameter/spacing incl. Westside bench zone, crossmembers, pull-up bars, safeties/spotter arms, J-cups, storage pegs, rear storage), horse stall mats (+ rows×cols layout tool), barbells (Olympic / short / EZ curl / trap) with per-sleeve plate stacks (bumper / iron / calibrated / change), pegboard with a hole grid and mountable accessories, benches, dumbbell rack, kettlebell, weight tree, cable machine, pulley, plate-loaded machine, cardio, shelves, wall barbell holder, bands, mirror.
- **2D planner (SVG)**: pan/zoom, grid + snapping to grid / walls / object edges (hold Alt to bypass), drag, rotate handle, edge resize handles, marquee + shift multi-select, numeric X/Y/rotation, center-in-room, align-to-wall, dimension annotations and distances to walls, clearance overlays, issue markers.
- **3D view (React Three Fiber)**: orbit/pan/zoom, perspective/orthographic, iso/top/front/side presets, per-wall auto/visible/transparent/hidden, optional ceiling, wireframe, shadows, instanced hole patterns, drag-to-move on the floor, labelled selection.
- **Checks**: outside room, physical intersection (3D-aware per component), insufficient clearance, door/window blocking, wall obstacles, wall-mount bounds, ceiling height. Mounted/contained objects (e.g. a barbell in a rack) are exempt from collisions with their parent. Click any warning to select the objects involved.
- **Designs**: multiple designs, save / revert / duplicate / rename / delete, autosaved draft, versioned JSON export/import with validation, floor plan export to PNG / SVG / print-to-PDF.
- **Shortcuts**: Del, ⌘/Ctrl+D, ⌘/Ctrl+Z, ⇧⌘/Ctrl+Z, ⌘/Ctrl+C/V/A/S, R rotate, H hide, L lock, arrows nudge, 1/2/3 switch 2D/3D/Split.

## Architecture

```
src/lib/units        mm <-> display conversion, parsing, formatting
src/lib/scene        renderer-independent scene model (single source of truth), defaults, factory
src/lib/equipment    one EquipmentDef per type: config -> Model (primitives + hole sets), validation,
                     fields, presets, default clearance; registry.ts (registerEquipment() to extend)
src/lib/geometry     OBB math (SAT), world placement, footprint/solids, snapping, scene validation
src/lib/store        Zustand store (history, designs, selection), pure scene-ops, localStorage
src/lib/persistence  zod schema, migration, import/export
src/components       planner2d (SVG), viewer3d (R3F), inspector, layout
```

**Synchronization**: both views read the same `scene` in the store, and both derive geometry from `modelOf(instance)` (memoized by config identity). The 2D silhouette, 3D meshes, footprint, and collision solids all come from that one `Model`; nothing geometric is stored twice.

**Coordinates**: mm. Room origin is the top-left (north-west) corner; +X along the length, +Y along the width (down on the plan, "south"), +Z up. An object's origin is the center of its footprint; its "front" faces +Y. Rotation is in degrees about the vertical axis (clockwise on the 2D plan). Three.js maps scene `(x, y, z)` to `(x, z, y)`.

## Assumptions & limits

- Rectangular rooms only (the room model keeps walls + openings as data so irregular rooms can be added later).
- Collision uses axis-aligned *vertical extents* plus oriented rectangles per component (not meshes). Cylinders use their bounding rectangle.
- Clearance zones are your own planning margins, **not** safety standards. No collision warnings does not mean a layout is safe.
- Dimensions of non-rack items are approximate bounding forms. Plate sizes are typical real-world values and editable.
- localStorage is per-browser; use JSON export for backups. GLB export is a possible later addition.
- Mounting a barbell snaps it into the rack's first J-cup; other mount targets (holders, storage racks) use the same parent/child mechanism with a simple offset.
