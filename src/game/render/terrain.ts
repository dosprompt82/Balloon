import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { noise1, hashInts } from '../core/rng';

const SIZE = 2400;
const SEG = 120;

export function terrainHeight(x: number, z: number): number {
  const n =
    noise1(x * 0.004 + noise1(z * 0.003, 3) * 2, 1) * 40 +
    noise1(z * 0.005 + noise1(x * 0.004, 5), 2) * 35 +
    noise1(x * 0.02, 7) * noise1(z * 0.02, 8) * 12;
  // flatten the launch meadow
  const d = Math.hypot(x, z + 10);
  const flat = Math.min(1, Math.max(0, (d - 40) / 120));
  return (n + 8) * flat;
}

const FIELD_COLORS = ['#e9c46a', '#a7c957', '#6a994e', '#bc8a5f', '#f2e8cf', '#d4a373', '#90be6d'];

/** Patchwork farmland on flat lowland ground; returns false where nature stays wild. */
function fieldColor(x: number, z: number, h: number, slope: number, out: THREE.Color): boolean {
  if (h < 0.5 || h > 16 || slope > 0.35) return false;
  const cx = Math.floor(x / 70);
  const cz = Math.floor(z / 55);
  const k = hashInts(cx * 73856093, cz);
  if (k % 5 === 0) return false;
  out.set(FIELD_COLORS[k % FIELD_COLORS.length]);
  // crop rows: subtle stripes
  const row = Math.floor(((k & 1 ? x : z) + 1000) / 6) % 2;
  if (row) out.multiplyScalar(0.93);
  return true;
}

function colorFor(h: number, slope: number, out: THREE.Color) {
  if (h < -6) out.set('#2a8fbd');
  else if (h < -3) out.set('#e9d8a6');
  else if (h < 35) out.set(slope > 0.5 ? '#6a994e' : '#7cc254').lerp(new THREE.Color('#4f8a3a'), Math.min(1, Math.max(0, h / 35)));
  else if (h < 55) out.set('#8d8d7a');
  else out.set('#f5f7fa');
}

/** Low-poly rolling landscape that recentres under the camera; also forests and farms. */
export class Terrain {
  readonly group = new THREE.Group();
  private geo: THREE.BufferGeometry;
  private water: THREE.Mesh;
  private trees: THREE.InstancedMesh;
  private trunks: THREE.InstancedMesh;
  private houses: THREE.InstancedMesh;
  private roofs: THREE.InstancedMesh;
  private centerX = Infinity;
  readonly launchPad: THREE.Group;
  readonly volcano: THREE.Group;
  private rocks: THREE.InstancedMesh;
  private flowers: THREE.InstancedMesh;
  private windmills: THREE.Group[] = [];
  private mountains: THREE.Group;

  constructor() {
    this.geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2).toNonIndexed();
    this.geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.geo.attributes.position.count * 3), 3));
    const land = new THREE.Mesh(this.geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    land.receiveShadow = true;
    this.group.add(land);

    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(SIZE * 1.6, SIZE * 1.6).rotateX(-Math.PI / 2),
      new THREE.MeshPhongMaterial({ color: '#3aa6d8', shininess: 80, transparent: true, opacity: 0.85 }),
    );
    this.water.position.y = -5;
    this.group.add(this.water);

    const treeGeo = mergeGeometries([
      new THREE.ConeGeometry(3.2, 6, 7).translate(0, 5, 0),
      new THREE.ConeGeometry(2.4, 5, 7).translate(0, 8.2, 0),
    ])!;
    this.trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshLambertMaterial({ color: '#2f7d4a', flatShading: true }), 900);
    this.trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.45, 0.6, 3, 6).translate(0, 1.5, 0), new THREE.MeshLambertMaterial({ color: '#6b4226' }), 900);
    this.houses = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 4, 5).translate(0, 2, 0), new THREE.MeshLambertMaterial({ color: '#f4e9d8' }), 60);
    const roof = new THREE.CylinderGeometry(0.01, 4.6, 3, 4, 1).rotateY(Math.PI / 4).scale(1.05, 1, 0.85).translate(0, 5.5, 0);
    this.roofs = new THREE.InstancedMesh(roof, new THREE.MeshLambertMaterial({ color: '#c8553d', flatShading: true }), 60);
    for (const m of [this.trees, this.trunks, this.houses, this.roofs]) {
      m.frustumCulled = false;
      this.group.add(m);
    }

    this.rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(2.2, 0), new THREE.MeshLambertMaterial({ color: '#8d8d82', flatShading: true }), 220);
    this.flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.9, 0), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), 600);
    for (const m of [this.rocks, this.flowers]) {
      m.frustumCulled = false;
      this.group.add(m);
    }
    const fc = new THREE.Color();
    const palette = ['#ff70a6', '#ffd670', '#ffffff', '#c77dff', '#ff9770'];
    for (let i = 0; i < 600; i++) this.flowers.setColorAt(i, fc.set(palette[i % palette.length]));
    for (let i = 0; i < 14; i++) {
      const w = makeWindmill();
      this.windmills.push(w);
      this.group.add(w);
    }
    this.mountains = makeMountains();
    this.group.add(this.mountains);

    this.launchPad = makeLaunchPad();
    this.group.add(this.launchPad);
    this.volcano = makeVolcano();
    this.volcano.visible = false;
    this.group.add(this.volcano);
  }

  /** Recentre on world x (render-space shift handled by parent). */
  update(worldX: number) {
    const cx = Math.round(worldX / 200) * 200;
    if (cx === this.centerX) return;
    this.centerX = cx;
    const pos = this.geo.attributes.position;
    const col = this.geo.attributes.color;
    const c = new THREE.Color();
    // triangles: compute per-face heights for a crisp low-poly look
    for (let i = 0; i < pos.count; i += 3) {
      let avg = 0;
      const hs: number[] = [];
      for (let k = 0; k < 3; k++) {
        const lx = this.baseX(i + k);
        const lz = this.baseZ(i + k);
        const h = terrainHeight(lx + cx, lz);
        pos.setY(i + k, h);
        hs.push(h);
        avg += h / 3;
      }
      const slope = (Math.max(...hs) - Math.min(...hs)) / 10;
      const fx = (this.baseX(i) + this.baseX(i + 1) + this.baseX(i + 2)) / 3 + cx;
      const fz = (this.baseZ(i) + this.baseZ(i + 1) + this.baseZ(i + 2)) / 3;
      if (!fieldColor(fx, fz, avg, slope, c)) colorFor(avg, slope, c);
      const jitter = 0.94 + (hashInts(i, cx) % 100) / 900;
      for (let k = 0; k < 3; k++) col.setXYZ(i + k, c.r * jitter, c.g * jitter, c.b * jitter);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.group.children[0].position.x = cx;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    let n = 0;
    for (let gx = -40; gx < 40 && n < 900; gx++) {
      for (let gz = -30; gz < 12 && n < 900; gz++) {
        const h0 = hashInts(gx + cx / 30, gz);
        if (h0 % 7 > 1) continue;
        const x = cx + gx * 30 + (h0 % 23) - 11;
        const z = gz * 30 + ((h0 >> 5) % 19) - 9;
        if (Math.abs(x) < 50 && Math.abs(z + 10) < 50) continue;
        const h = terrainHeight(x, z);
        if (h < -2 || h > 34) continue;
        const sc = 0.7 + ((h0 >> 9) % 60) / 60;
        s.set(sc, sc * (0.9 + ((h0 >> 3) % 5) / 10), sc);
        m.compose(new THREE.Vector3(x, h - 0.3, z), q, s);
        this.trees.setMatrixAt(n, m);
        this.trunks.setMatrixAt(n, m);
        n++;
      }
    }
    this.trees.count = this.trunks.count = n;
    this.trees.instanceMatrix.needsUpdate = this.trunks.instanceMatrix.needsUpdate = true;
    let hcount = 0;
    for (let i = 0; i < 160 && hcount < 60; i++) {
      const h0 = hashInts(i, cx);
      const x = cx + ((h0 % 2000) - 1000);
      const z = -(((h0 >> 11) % 700) + 40);
      const h = terrainHeight(x, z);
      if (h < 0 || h > 22) continue;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((h0 >> 4) % 628) / 100);
      m.compose(new THREE.Vector3(x, h - 0.2, z), q, new THREE.Vector3(1, 1, 1));
      this.houses.setMatrixAt(hcount, m);
      this.roofs.setMatrixAt(hcount, m);
      hcount++;
    }
    this.houses.count = this.roofs.count = hcount;
    this.houses.instanceMatrix.needsUpdate = this.roofs.instanceMatrix.needsUpdate = true;

    // rocks on hillsides, flower meadows, windmills on the farms
    let rc = 0;
    let fcount = 0;
    for (let i = 0; i < 1400; i++) {
      const h0 = hashInts(i * 31, cx + 7);
      const x = cx + ((h0 % 2200) - 1100);
      const z = -(((h0 >> 12) % 900) - 120);
      const h = terrainHeight(x, z);
      if (Math.abs(x) < 40 && Math.abs(z + 10) < 40) continue;
      if (h > 22 && rc < 220) {
        const s = 0.6 + ((h0 >> 3) % 10) / 6;
        q.setFromEuler(new THREE.Euler((h0 % 7) * 0.4, (h0 % 11) * 0.5, 0));
        m.compose(new THREE.Vector3(x, h - 0.5, z), q, new THREE.Vector3(s, s * 0.7, s));
        this.rocks.setMatrixAt(rc++, m);
      } else if (h > 0 && h < 18 && fcount < 600 && (h0 >> 7) % 3 === 0) {
        q.identity();
        m.compose(new THREE.Vector3(x, h + 0.3, z), q, new THREE.Vector3(1, 0.6, 1));
        this.flowers.setMatrixAt(fcount++, m);
      }
    }
    this.rocks.count = rc;
    this.flowers.count = fcount;
    this.rocks.instanceMatrix.needsUpdate = this.flowers.instanceMatrix.needsUpdate = true;
    let wi = 0;
    for (let i = 0; i < 300 && wi < this.windmills.length; i++) {
      const h0 = hashInts(i * 97, cx + 3);
      const x = cx + ((h0 % 1800) - 900);
      const z = -(((h0 >> 11) % 600) + 60);
      const h = terrainHeight(x, z);
      if (h < 1 || h > 14) continue;
      const w = this.windmills[wi++];
      w.visible = true;
      w.position.set(x, h - 0.3, z);
      w.rotation.y = ((h0 >> 4) % 100) / 100 - 0.5;
    }
    for (; wi < this.windmills.length; wi++) this.windmills[wi].visible = false;
    this.mountains.position.x = cx;
  }

  /** Animated scenery (windmill sails, waving flags). */
  animate(t: number) {
    for (const [i, w] of this.windmills.entries()) {
      const sails = w.getObjectByName('sails');
      if (sails) sails.rotation.z = t * (0.8 + (i % 3) * 0.25);
    }
    this.launchPad.children.forEach((o, i) => {
      if (o.name === 'flag') o.rotation.y = Math.sin(t * 3 + i) * 0.4;
    });
  }

  private baseX(i: number) {
    return this.baseCoords(i)[0];
  }
  private baseZ(i: number) {
    return this.baseCoords(i)[1];
  }
  private base?: Float32Array;
  private baseCoords(i: number): [number, number] {
    if (!this.base) {
      const p = this.geo.attributes.position;
      this.base = new Float32Array(p.count * 2);
      for (let k = 0; k < p.count; k++) {
        this.base[k * 2] = p.getX(k);
        this.base[k * 2 + 1] = p.getZ(k);
      }
    }
    return [this.base[i * 2], this.base[i * 2 + 1]];
  }
}

function makeWindmill(): THREE.Group {
  const g = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 11, 8), new THREE.MeshLambertMaterial({ color: '#f1e3c8', flatShading: true }));
  tower.position.y = 5.5;
  g.add(tower);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.3, 2.8, 8), new THREE.MeshLambertMaterial({ color: '#9c2f2f', flatShading: true }));
  cap.position.y = 12.3;
  g.add(cap);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.2), new THREE.MeshLambertMaterial({ color: '#5b3a1e' }));
  door.position.set(0, 0.9, 2.4);
  g.add(door);
  const sails = new THREE.Group();
  sails.name = 'sails';
  sails.position.set(0, 10.5, 2.2);
  const sailMat = new THREE.MeshLambertMaterial({ color: '#fdf6e3', side: THREE.DoubleSide });
  const spar = new THREE.MeshLambertMaterial({ color: '#6b4226' });
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i / 4) * Math.PI * 2;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.25, 7, 0.2), spar);
    beam.position.y = 3.5;
    arm.add(beam);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 5.5), sailMat);
    sail.position.set(0.95, 4, 0.05);
    arm.add(sail);
    sails.add(arm);
  }
  sails.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), spar));
  g.add(sails);
  return g;
}

function makeMountains(): THREE.Group {
  const g = new THREE.Group();
  const rock = new THREE.MeshLambertMaterial({ color: '#8d9ac4', flatShading: true, fog: false });
  const snow = new THREE.MeshLambertMaterial({ color: '#f4f8ff', flatShading: true, fog: false });
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const h0 = hashInts(i, 4242);
    const r = 1550 + (h0 % 350);
    const height = 120 + (h0 % 200);
    const width = height * (1.5 + ((h0 >> 8) % 10) / 10);
    const peak = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(width, height, 6, 1), rock);
    body.position.y = height / 2 - 10;
    peak.add(body);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(width * 0.32, height * 0.32, 6, 1), snow);
    cap.position.y = height - 10 - height * 0.16 + 1;
    peak.add(cap);
    peak.position.set(Math.cos(a) * r, 0, Math.sin(a) * r - 300);
    peak.rotation.y = (h0 % 10) * 0.3;
    g.add(peak);
  }
  return g;
}

function makeLaunchPad(): THREE.Group {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.5, 0.4, 24), new THREE.MeshLambertMaterial({ color: '#d9c8a0' }));
  pad.position.y = 0.2;
  g.add(pad);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.25, 6, 32).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#ff6b4a' }));
  ring.position.y = 0.45;
  g.add(ring);
  const colors = ['#ff6b4a', '#ffd166', '#06d6a0', '#118ab2'];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), new THREE.MeshLambertMaterial({ color: '#eeeeee' }));
    pole.position.set(Math.cos(a) * 13, 3, Math.sin(a) * 13);
    g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshLambertMaterial({ color: colors[i % 4], side: THREE.DoubleSide }));
    flag.position.set(Math.cos(a) * 13 + 0.9, 5.4, Math.sin(a) * 13);
    flag.name = 'flag';
    g.add(flag);
  }
  // little tent and crates
  const tent = new THREE.Mesh(new THREE.ConeGeometry(4, 4, 4), new THREE.MeshLambertMaterial({ color: '#f1faee', flatShading: true }));
  tent.position.set(-18, 2, -8);
  g.add(tent);
  for (let i = 0; i < 3; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), new THREE.MeshLambertMaterial({ color: '#b07d48' }));
    crate.position.set(14 + i * 1.8, 0.8 + (i === 2 ? 1.6 : 0), -6 + (i === 2 ? -1.8 : 0));
    g.add(crate);
  }
  return g;
}

function makeVolcano(): THREE.Group {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(18, 120, 130, 12, 3, true), new THREE.MeshLambertMaterial({ color: '#5a4636', flatShading: true }));
  cone.position.y = 60;
  g.add(cone);
  const lava = new THREE.Mesh(new THREE.CircleGeometry(17, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff5a1f' }));
  lava.position.y = 124;
  g.add(lava);
  return g;
}
