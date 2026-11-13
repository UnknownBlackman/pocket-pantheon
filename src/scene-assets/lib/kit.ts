/**
 * A tiny low-poly construction kit: add primitive parts with a colour and a
 * transform, then merge them into ONE vertex-coloured mesh (one draw call).
 * Flat shading gives the faceted, hand-carved diorama look. Deterministic:
 * the only randomness is the seeded generator below.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from '@iwsdk/core';

/** The one material every kit mesh shares: colours come from the vertices. */
export const KIT_MATERIAL = new MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.92,
  metalness: 0,
});

export interface Place {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

const m4 = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const p = new Vector3();
const s = new Vector3();
const c = new Color();

export class Kit {
  private positions: number[] = [];
  private colors: number[] = [];

  /** Adds any geometry, transformed and painted one colour. */
  add(geometry: BufferGeometry, color: number, at: Place = {}): this {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const pos = g.getAttribute('position');
    e.set(at.rx ?? 0, at.ry ?? 0, at.rz ?? 0);
    q.setFromEuler(e);
    p.set(at.x ?? 0, at.y ?? 0, at.z ?? 0);
    s.set(at.sx ?? 1, at.sy ?? 1, at.sz ?? 1);
    m4.compose(p, q, s);
    c.setHex(color);
    const v = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m4);
      this.positions.push(v.x, v.y, v.z);
      this.colors.push(c.r, c.g, c.b);
    }
    if (g !== geometry) g.dispose();
    geometry.dispose();
    return this;
  }

  box(w: number, h: number, d: number, color: number, at: Place = {}): this {
    return this.add(new BoxGeometry(w, h, d), color, at);
  }

  /** Cylinder standing on its base (origin at the bottom centre). */
  cyl(rTop: number, rBottom: number, h: number, segments: number, color: number, at: Place = {}): this {
    const g = new CylinderGeometry(rTop, rBottom, h, segments, 1);
    g.translate(0, h / 2, 0);
    return this.add(g, color, at);
  }

  /** Cone standing on its base (origin at the bottom centre). */
  cone(r: number, h: number, segments: number, color: number, at: Place = {}): this {
    const g = new ConeGeometry(r, h, segments, 1);
    g.translate(0, h / 2, 0);
    return this.add(g, color, at);
  }

  /** Faceted blob (rock, puff, head, tree crown). Origin at its centre. */
  ico(r: number, color: number, at: Place = {}, detail = 0): this {
    return this.add(new IcosahedronGeometry(r, detail), color, at);
  }

  /**
   * Gable roof / triangular prism: ridge along X, width `w` (X), base depth
   * `d` (Z), ridge height `h`. Origin at the middle of the base.
   */
  gable(w: number, h: number, d: number, color: number, at: Place = {}): this {
    return this.add(gableGeometry(w, h, d), color, at);
  }

  /** A thin bar from point a to point b (beams, fence rails, legs). */
  bar(ax: number, ay: number, az: number, bx: number, by: number, bz: number, thick: number, color: number): this {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const g = new BoxGeometry(thick, len, thick);
    // Align the box's +Y with the bar direction.
    const dir = new Vector3(dx, dy, dz).normalize();
    const rot = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
    m4.compose(new Vector3((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), rot, new Vector3(1, 1, 1));
    g.applyMatrix4(m4);
    return this.add(g, color);
  }

  get empty(): boolean {
    return this.positions.length === 0;
  }

  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.colors), 3));
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }

  /** Merges everything added so far into one named mesh. */
  mesh(name: string, material: MeshStandardMaterial = KIT_MATERIAL): Mesh {
    const m = new Mesh(this.geometry(), material);
    m.name = name;
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  }
}

export function gableGeometry(w: number, h: number, d: number): BufferGeometry {
  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -d / 2;
  const z1 = d / 2;
  // Triangles (counter-clockwise from outside).
  const v = [
    // end caps
    x0, 0, z1, x0, h, 0, x0, 0, z0,
    x1, 0, z0, x1, h, 0, x1, 0, z1,
    // front slope (+Z)
    x0, 0, z1, x1, 0, z1, x1, h, 0,
    x0, 0, z1, x1, h, 0, x0, h, 0,
    // back slope (-Z)
    x1, 0, z0, x0, 0, z0, x0, h, 0,
    x1, 0, z0, x0, h, 0, x1, h, 0,
    // underside
    x0, 0, z0, x1, 0, z0, x1, 0, z1,
    x0, 0, z0, x1, 0, z1, x0, 0, z1,
  ];
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(v), 3));
  g.computeVertexNormals();
  return g;
}

/** Seeded random in [0, 1) (mulberry32) for deterministic scatter. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Earthy colour helpers: vary a base colour slightly for a hand-made look. */
export function vary(hex: number, rand: () => number, amount = 0.08): number {
  const col = new Color(hex);
  const f = 1 + (rand() * 2 - 1) * amount;
  col.r = Math.min(1, col.r * f);
  col.g = Math.min(1, col.g * f);
  col.b = Math.min(1, col.b * f);
  return col.getHex();
}
