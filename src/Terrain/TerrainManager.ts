import * as THREE from "three";
import ClientPhysics from "../ClientPhysics";
import { createSandMaterial } from "./sandMaterial";

export type TerrainData = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  heights: ArrayBuffer;
  roadMask: ArrayBuffer; // kept for compat; not used to render
  nrows: number;
  ncols: number;
  scale: THREE.Vector3;

  // --- Road inputs (any one is fine) ---
  roadPath?: Float32Array; // [x0,z0,x1,z1,...] in GRID coords
  roadCurves?: Float32Array; // multiples of 8: [p0.x,p0.z,p1.x,p1.z,p2.x,p2.z,p3.x,p3.z,  ...]
  asphaltHalf?: number; // half-width in GRID units (defaults 7)
  roadHeight?: number; // flat Y in GRID units (defaults 0.25)
};

export default class TerrainManager {
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  // ---- Helpers: cubic Bezier in 2D (grid space) ----
  private static bezier2D(
    t: number,
    p0: THREE.Vector2,
    p1: THREE.Vector2,
    p2: THREE.Vector2,
    p3: THREE.Vector2
  ): THREE.Vector2 {
    const u = 1 - t;
    const tt = t * t,
      uu = u * u;
    const uuu = uu * u,
      ttt = tt * t;
    const out = new THREE.Vector2();
    out.addScaledVector(p0, uuu);
    out.addScaledVector(p1, 3 * uu * t);
    out.addScaledVector(p2, 3 * u * tt);
    out.addScaledVector(p3, ttt);
    return out;
  }

  private static lengthApprox(
    p0: THREE.Vector2,
    p1: THREE.Vector2,
    p2: THREE.Vector2,
    p3: THREE.Vector2,
    samples = 16
  ): number {
    let len = 0;
    let prev = p0.clone();
    for (let i = 1; i <= samples; i++) {
      const t = i / samples;
      const cur = TerrainManager.bezier2D(t, p0, p1, p2, p3);
      len += cur.distanceTo(prev);
      prev.copy(cur);
    }
    return len;
  }

  private static sampleBezierUniform(
    p0: THREE.Vector2,
    p1: THREE.Vector2,
    p2: THREE.Vector2,
    p3: THREE.Vector2,
    spacing = 1.0 // in GRID units
  ): Float32Array {
    const L = Math.max(1e-4, TerrainManager.lengthApprox(p0, p1, p2, p3, 32));
    const n = Math.max(2, Math.ceil(L / spacing));
    const out: number[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = TerrainManager.bezier2D(t, p0, p1, p2, p3);
      out.push(p.x, p.y);
    }
    return new Float32Array(out);
  }

  private static buildRoadPathFromCurves(
    roadCurves: Float32Array,
    spacing = 1.0
  ): Float32Array {
    const out: number[] = [];
    for (let i = 0; i + 7 < roadCurves.length; i += 8) {
      const p0 = new THREE.Vector2(roadCurves[i + 0], roadCurves[i + 1]);
      const p1 = new THREE.Vector2(roadCurves[i + 2], roadCurves[i + 3]);
      const p2 = new THREE.Vector2(roadCurves[i + 4], roadCurves[i + 5]);
      const p3 = new THREE.Vector2(roadCurves[i + 6], roadCurves[i + 7]);
      const seg = TerrainManager.sampleBezierUniform(p0, p1, p2, p3, spacing);
      // append; but skip the first point after the first segment to avoid duplicates
      const start = out.length === 0 ? 0 : 2;
      for (let k = start; k < seg.length; k++) out.push(seg[k]);
    }
    return new Float32Array(out);
  }

  create(terrain: TerrainData) {
    const { position, heights, nrows, ncols, scale } = terrain;
    const newHeights = new Float32Array(heights);

    // ---------- Terrain mesh ----------
    const geom = new THREE.BufferGeometry();
    const verts: number[] = [];
    const uvs: number[] = [];
    const inds: number[] = [];

    const halfWidth = (ncols - 1) / 2;
    const halfDepth = (nrows - 1) / 2;

    let minH = Infinity;
    let maxH = -Infinity;

    for (let i = 0; i < nrows; i++) {
      for (let j = 0; j < ncols; j++) {
        const idx = i * ncols + j;
        const x = i - halfDepth;
        const y = newHeights[idx];
        const z = j - halfWidth;
        verts.push(x, y, z);
        uvs.push(j / (ncols - 1), i / (nrows - 1));
        if (y < minH) minH = y;
        if (y > maxH) maxH = y;
      }
    }

    for (let i = 0; i < nrows - 1; i++) {
      for (let j = 0; j < ncols - 1; j++) {
        const a = i * ncols + j;
        const b = a + 1;
        const c = (i + 1) * ncols + j;
        const d = c + 1;
        inds.push(a, b, d, a, d, c);
      }
    }

    geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(inds);
    geom.computeVertexNormals();

    const terrainMat = createSandMaterial(0xf7d599);

    const terrainMesh = new THREE.Mesh(geom, terrainMat);
    terrainMesh.position.copy(position);
    terrainMesh.scale.set(
      scale.x / (ncols - 1),
      scale.y,
      scale.z / (nrows - 1)
    );
    this.scene.add(terrainMesh);

    // Physics heightfield (unchanged)
    ClientPhysics.instance.createHeightfield(
      terrain.position,
      terrain.quaternion,
      new Float32Array(terrain.heights),
      terrain.scale,
      terrain.nrows - 1,
      terrain.ncols - 1
    );

    // ---------- Road ribbon mesh (perfect straight edges) ----------
    // Choose a centerline source:

    console.log(terrain, "ter");
    let roadPath: Float32Array | undefined = terrain.roadPath;

    // if (
    //   (!roadPath || roadPath.length < 4) &&
    //   terrain.roadCurves &&
    //   terrain.roadCurves.length >= 8
    // ) {
    //   // Build path by sampling Bezier segments ~1 grid unit spacing
    //   roadPath = TerrainManager.buildRoadPathFromCurves(
    //     terrain.roadCurves,
    //     1.0
    //   );
    // }

    if (terrain.roadCurves) {
      roadPath = TerrainManager.buildRoadPathFromCurves(
        new Float32Array(terrain.roadCurves),
        1.0
      );
      console.log(roadPath);
    }

    //console.log(roadPath, roadPath?.length);
    console.log(roadPath, roadPath?.length, "road len");
    if (roadPath && roadPath.length >= 4) {
      const asphaltHalfGrid = terrain.asphaltHalf ?? 7.0;
      const roadHeightGrid = terrain.roadHeight ?? 0.25;

      // GRID -> WORLD helpers
      const gxToWorldX = (gx: number) =>
        (gx - halfDepth) * (scale.x / (ncols - 1)) + position.x;
      const gzToWorldZ = (gz: number) =>
        (gz - halfWidth) * (scale.z / (nrows - 1)) + position.z;
      const gyToWorldY = (gy: number) => gy * scale.y + position.y;

      // Convert path to world points at flat height
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < roadPath.length; i += 2) {
        const gx = roadPath[i],
          gz = roadPath[i + 1];
        pts.push(
          new THREE.Vector3(
            gxToWorldX(gx),
            gyToWorldY(roadHeightGrid),
            gzToWorldZ(gz)
          )
        );
      }

      // world-space half width (same as you had)
      const gridToWorldScale =
        (scale.x / (ncols - 1) + scale.z / (nrows - 1)) * 0.5;
      const halfWidthWorld = asphaltHalfGrid * gridToWorldScale;

      const vertsRoad: number[] = [];
      const uvsRoad: number[] = [];
      const indsRoad: number[] = [];
      const leftIdx: number[] = [];
      const rightIdx: number[] = [];

      // direction helper
      const getDir = (a: THREE.Vector3, b: THREE.Vector3) => {
        const d = new THREE.Vector3().subVectors(b, a);
        d.y = 0;
        const len = Math.max(1e-6, d.length());
        return d.multiplyScalar(1 / len);
      };

      // accumulate length along the centerline for v-UVs
      const sAccum: number[] = new Array(pts.length).fill(0);
      for (let i = 1; i < pts.length; i++) {
        sAccum[i] = sAccum[i - 1] + pts[i].distanceTo(pts[i - 1]);
      }

      // how dense to tile the texture along the road (meters per repeat)
      const metersPerRepeat = 18; // tweak to taste

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const pPrev = pts[Math.max(0, i - 1)];
        const pNext = pts[Math.min(pts.length - 1, i + 1)];
        const dir = getDir(pPrev, pNext);
        const normal = new THREE.Vector3(-dir.z, 0, dir.x); // 90° left

        const L = new THREE.Vector3().addVectors(
          p,
          new THREE.Vector3().copy(normal).multiplyScalar(halfWidthWorld)
        );
        const R = new THREE.Vector3().addVectors(
          p,
          new THREE.Vector3().copy(normal).multiplyScalar(-halfWidthWorld)
        );

        // positions (slightly lifted to avoid z-fighting)
        leftIdx.push(vertsRoad.length / 3);
        vertsRoad.push(L.x, L.y + 0.001, L.z);
        rightIdx.push(vertsRoad.length / 3);
        vertsRoad.push(R.x, R.y + 0.001, R.z);

        // UVs: u=0 (left) / u=1 (right), v = length / metersPerRepeat
        const v = sAccum[i] / metersPerRepeat;
        uvsRoad.push(0, v); // left
        uvsRoad.push(1, v); // right
      }

      // triangles
      for (let i = 0; i < pts.length - 1; i++) {
        const l0 = leftIdx[i],
          r0 = rightIdx[i];
        const l1 = leftIdx[i + 1],
          r1 = rightIdx[i + 1];
        indsRoad.push(l0, r0, l1, r0, r1, l1);
      }

      // build geometry with UVs
      const roadGeo = new THREE.BufferGeometry();
      roadGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertsRoad, 3)
      );
      roadGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvsRoad, 2));
      roadGeo.setIndex(indsRoad);
      roadGeo.computeVertexNormals();

      // texture & material
      const tex = new THREE.TextureLoader().load("textures/road.jpg");
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.rotation = Math.PI / 2;
      // u repeats are already 0..1 across; v tiling comes from our UVs above.
      // If the texture looks too stretched/squished, adjust metersPerRepeat above.

      // three r150+:
      if ("colorSpace" in tex) {
        // @ts-ignore
        tex.colorSpace = THREE.SRGBColorSpace;
      } else {
        // older three:
        // @ts-ignore
        tex.encoding = THREE.sRGBEncoding;
      }
      tex.anisotropy = 8; // nicer at glancing angles

      const roadMat = new THREE.MeshStandardMaterial({
        map: tex,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        side: THREE.BackSide,
      });

      const roadMesh = new THREE.Mesh(roadGeo, roadMat);
      this.scene.add(roadMesh);
    }
  }
}
