import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '../core/rng';

/** A puffy cumulus built from overlapping displaced icospheres with baked top-light shading. */
export function makeCloudGeometry(rng: Rng, puffs = 7, flat = 0.62): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < puffs; i++) {
    const r = rng.range(0.55, 1.05) * (i === 0 ? 1.25 : 1);
    let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(r, 3);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    g = mergeVertices(g);
    const pos = g.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v);
      const y = pos.getY(v);
      const z = pos.getZ(v);
      const n = 1 + Math.sin(x * 5.1 + y * 3.7) * 0.05 + Math.cos(z * 4.3 - y * 2.1) * 0.05;
      pos.setXYZ(v, x * n, y * n, z * n);
    }
    const a = (i / puffs) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const spread = i === 0 ? 0 : rng.range(0.8, 1.6);
    g.translate(Math.cos(a) * spread * 1.4, rng.range(-0.1, 0.45) * (i === 0 ? 0.4 : 1), Math.sin(a) * spread * 0.8);
    g.computeVertexNormals();
    parts.push(g.toNonIndexed());
  }
  const merged = mergeGeometries(parts)!;
  merged.scale(1, flat, 1);
  merged.computeBoundingBox();
  const bb = merged.boundingBox!;
  const pos = merged.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let v = 0; v < pos.count; v++) {
    const t = (pos.getY(v) - bb.min.y) / (bb.max.y - bb.min.y);
    // flat underside darker, sunlit tops bright
    const c = 0.72 + 0.28 * Math.pow(t, 0.7);
    colors[v * 3] = c;
    colors[v * 3 + 1] = c;
    colors[v * 3 + 2] = c + 0.04 * (1 - t);
  }
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return merged;
}

interface CloudSlot {
  x: number;
  y: number;
  z: number;
  s: number;
  sy: number;
  rot: number;
  variant: number;
  drift: number;
}

/**
 * Recycled field of instanced clouds around the camera. Positions are kept in render
 * space (already shifted by the floating origin) and wrap within a box.
 */
export class CloudField {
  readonly group = new THREE.Group();
  readonly material: THREE.MeshLambertMaterial;
  private meshes: THREE.InstancedMesh[] = [];
  private slots: CloudSlot[] = [];
  private rng = new Rng(4242);
  private dummy = new THREE.Object3D();
  private box = { x: 520, yDown: 260, yUp: 320 };
  density = 1;

  constructor(count: number) {
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true, color: '#ffffff', emissive: new THREE.Color('#000000') });
    // clouds glow softly so their shadowed sides never turn muddy grey
    this.material.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight = mix(outgoingLight, diffuseColor.rgb, 0.45);\n#include <opaque_fragment>');
    };
    const variants = 6;
    const per = Math.ceil(count / variants);
    for (let v = 0; v < variants; v++) {
      const geo = makeCloudGeometry(this.rng, 6 + v, 0.55 + v * 0.03);
      const m = new THREE.InstancedMesh(geo, this.material, per);
      m.frustumCulled = false;
      this.meshes.push(m);
      this.group.add(m);
    }
    for (let i = 0; i < per * variants; i++) {
      this.slots.push(this.newSlot(i % variants, 0, 0, true));
    }
  }

  private newSlot(variant: number, cx: number, cy: number, anywhere: boolean, fromSide = 0): CloudSlot {
    const r = this.rng;
    const layer = r.next();
    // mostly background, some mid-ground, a few foreground wisps
    const z = layer < 0.75 ? r.range(-480, -90) : layer < 0.93 ? r.range(-80, -35) : r.range(40, 75);
    const s = z > 0 ? r.range(4, 7) : r.range(9, 26) * (z < -250 ? 1.6 : 1);
    let x = cx + r.range(-this.box.x, this.box.x);
    let y = cy + r.range(-this.box.yDown, this.box.yUp);
    if (!anywhere) {
      if (fromSide !== 0) x = cx + fromSide * this.box.x * r.range(0.9, 1);
      else y = cy + this.box.yUp * r.range(0.85, 1);
    }
    return { x, y, z, s, sy: s * r.range(0.8, 1.15), rot: r.range(0, Math.PI * 2), variant, drift: r.range(0.5, 2) };
  }

  update(dt: number, camX: number, camY: number, wind: number) {
    const counters = new Array(this.meshes.length).fill(0);
    const visible = Math.floor(this.slots.length * Math.min(1, this.density));
    for (let i = 0; i < this.slots.length; i++) {
      let c = this.slots[i];
      c.x += wind * c.drift * dt * 0.6;
      const dx = c.x - camX;
      const dy = c.y - camY;
      if (dx > this.box.x) c = this.slots[i] = this.newSlot(c.variant, camX, camY, false, -1);
      else if (dx < -this.box.x) c = this.slots[i] = this.newSlot(c.variant, camX, camY, false, 1);
      else if (dy < -this.box.yDown) c = this.slots[i] = this.newSlot(c.variant, camX, camY, false);
      else if (dy > this.box.yUp) {
        c.y = camY - this.box.yDown * 0.95;
      }
      const m = this.meshes[c.variant];
      const idx = counters[c.variant]++;
      this.dummy.position.set(c.x, c.y, c.z);
      const s = i < visible ? 1 : 0.0001;
      this.dummy.scale.set(c.s * s, c.sy * s, c.s * s);
      this.dummy.rotation.set(0, c.rot, 0);
      this.dummy.updateMatrix();
      m.setMatrixAt(idx, this.dummy.matrix);
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }

  /** Shift by a floating-origin rebase. */
  shift(dx: number, dy: number) {
    for (const c of this.slots) {
      c.x -= dx;
      c.y -= dy;
    }
  }
}
