import * as THREE from 'three';
import { Rng } from '../core/rng';
import { glowTexture } from './textures';
import { smoothstep } from '../core/math';

/** Starfield that rides with the camera. */
export class Starfield {
  readonly points: THREE.Points;
  constructor() {
    const rng = new Rng(77);
    const n = 2600;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const u = rng.range(-1, 1);
      const th = rng.range(0, Math.PI * 2);
      const r = Math.sqrt(1 - u * u);
      pos.set([Math.cos(th) * r * 4000, Math.abs(u) * 4000 - 600, Math.sin(th) * r * 4000], i * 3);
      c.setHSL(rng.pick([0.6, 0.62, 0.08, 0.75, 0.55]), rng.range(0.2, 0.7), rng.range(0.75, 1));
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.points = new THREE.Points(
      g,
      new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false }),
    );
    this.points.renderOrder = -9;
    this.points.frustumCulled = false;
  }
  update(cam: THREE.Vector3, amount: number, t: number) {
    this.points.position.copy(cam);
    this.points.rotation.y = t * 0.002;
    const m = this.points.material as THREE.PointsMaterial;
    m.opacity = Math.min(1, amount);
    this.points.visible = amount > 0.02;
  }
}

function floatingIsland(rng: Rng): THREE.Object3D {
  const g = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.ConeGeometry(14, 26, 7, 2).rotateX(Math.PI), new THREE.MeshLambertMaterial({ color: '#7a6a8a', flatShading: true }));
  rock.position.y = -13;
  g.add(rock);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(14.5, 14, 2.5, 7), new THREE.MeshLambertMaterial({ color: '#5ee6a8', flatShading: true }));
  g.add(top);
  for (let i = 0; i < 6; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(2, 10);
    const tree = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 6), new THREE.MeshLambertMaterial({ color: rng.pick(['#ff70a6', '#70d6ff', '#e9ff70', '#c77dff']), flatShading: true }));
    tree.position.set(Math.cos(a) * r, 3.5, Math.sin(a) * r);
    g.add(tree);
  }
  const temple = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 6), new THREE.MeshLambertMaterial({ color: '#f1faee' }));
    col.position.set((i % 2 ? 1 : -1) * 3, 4, (i < 2 ? 1 : -1) * 3);
    temple.add(col);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.5, 3, 4).rotateY(Math.PI / 4), new THREE.MeshLambertMaterial({ color: '#ffd166', flatShading: true }));
  roof.position.y = 8.5;
  temple.add(roof);
  temple.position.x = rng.range(-5, 5);
  g.add(temple);
  const wf = new THREE.Mesh(new THREE.PlaneGeometry(2, 40), new THREE.MeshBasicMaterial({ color: '#bdf6ff', transparent: true, opacity: 0.6 }));
  wf.position.set(10, -18, 8);
  g.add(wf);
  return g;
}

function skyWhale(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#5a7bd8', emissive: '#2a3f8f', emissiveIntensity: 0.5, roughness: 0.6 });
  const belly = new THREE.MeshStandardMaterial({ color: '#cfe4ff', emissive: '#6a8ad8', emissiveIntensity: 0.3 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(10, 20, 14).scale(2.6, 1, 1), mat);
  g.add(body);
  const b2 = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 10).scale(2.3, 0.6, 0.9), belly);
  b2.position.y = -3.5;
  g.add(b2);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(6, 14, 4).rotateZ(Math.PI / 2).scale(1, 1, 0.3), mat);
  tail.position.x = -30;
  tail.name = 'tail';
  g.add(tail);
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(3, 12, 4).scale(1, 1, 0.3), mat);
    fin.position.set(6, -6, s * 8);
    fin.rotation.x = s * 1.1;
    g.add(fin);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff3b0' }));
    eye.position.set(20, 1, s * 7.5);
    g.add(eye);
  }
  for (let i = 0; i < 6; i++) {
    const spot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#9ffff0', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    spot.position.set(-10 + i * 5, 8, (i % 2 ? 1 : -1) * 4);
    spot.scale.setScalar(4);
    g.add(spot);
  }
  return g;
}

function ancientRing(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(40, 3, 8, 48), new THREE.MeshStandardMaterial({ color: '#d9c7a0', roughness: 0.8, flatShading: true })));
  const glow = new THREE.Mesh(new THREE.TorusGeometry(40, 0.8, 6, 64), new THREE.MeshBasicMaterial({ color: '#7df9ff', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
  g.add(glow);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rune = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 4), new THREE.MeshStandardMaterial({ color: '#b8a57e', emissive: '#00f5d4', emissiveIntensity: 0.4 }));
    rune.position.set(Math.cos(a) * 40, Math.sin(a) * 40, 0);
    rune.rotation.z = a;
    g.add(rune);
  }
  return g;
}

function crystal(rng: Rng): THREE.Object3D {
  const g = new THREE.Group();
  const c = rng.pick(['#c77dff', '#7df9ff', '#ff70a6']);
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(rng.range(4, 9), 0).scale(0.5, 2, 0.5), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, transparent: true, opacity: 0.85, flatShading: true }));
    m.position.set(rng.range(-8, 8), rng.range(-6, 6), rng.range(-6, 6));
    m.rotation.set(rng.range(-0.5, 0.5), 0, rng.range(-0.6, 0.6));
    g.add(m);
  }
  return g;
}

interface Wonder {
  obj: THREE.Object3D;
  kind: 'island' | 'whale' | 'ring' | 'crystal';
  x: number;
  y: number;
  z: number;
  vx: number;
  minAlt: number;
}

/** Distant fantastical set-dressing for the upper zones; recycled around the camera. */
export class Wonders {
  readonly group = new THREE.Group();
  private items: Wonder[] = [];
  private rng = new Rng(2024);
  constructor() {
    const spec: [Wonder['kind'], number, number][] = [
      ['crystal', 5, 50000], ['ring', 2, 80000], ['island', 5, 95000], ['whale', 3, 90000],
    ];
    for (const [kind, n, minAlt] of spec) {
      for (let i = 0; i < n; i++) {
        const obj = kind === 'island' ? floatingIsland(this.rng) : kind === 'whale' ? skyWhale() : kind === 'ring' ? ancientRing() : crystal(this.rng);
        this.group.add(obj);
        this.items.push({ obj, kind, x: 0, y: 0, z: 0, vx: 0, minAlt });
        this.place(this.items[this.items.length - 1], 0, 0, true);
      }
    }
  }
  private place(w: Wonder, cx: number, cy: number, anywhere: boolean, side = 0) {
    const r = this.rng;
    w.x = cx + (anywhere ? r.range(-700, 700) : side * 700);
    w.y = cy + r.range(-200, 260);
    w.z = r.range(-650, -220);
    w.vx = w.kind === 'whale' ? r.sign() * r.range(8, 15) : r.range(-1, 1);
    w.obj.scale.setScalar(w.kind === 'whale' ? r.range(0.7, 1.2) : r.range(0.8, 1.6));
    w.obj.rotation.y = w.kind === 'whale' ? (w.vx > 0 ? 0 : Math.PI) : r.range(0, Math.PI * 2);
  }
  update(dt: number, t: number, cx: number, cy: number, alt: number) {
    for (const w of this.items) {
      const vis = smoothstep(w.minAlt * 0.8, w.minAlt, alt);
      w.obj.visible = vis > 0.01;
      if (!w.obj.visible) continue;
      w.x += w.vx * dt;
      if (w.x - cx > 750) this.place(w, cx, cy, false, -1);
      else if (w.x - cx < -750) this.place(w, cx, cy, false, 1);
      if (w.y - cy < -320) w.y += 600;
      if (w.y - cy > 320) w.y -= 600;
      const bob = Math.sin(t * 0.3 + w.z) * 4;
      w.obj.position.set(w.x, w.y + bob, w.z);
      if (w.kind === 'ring') w.obj.rotation.y += dt * 0.1;
      if (w.kind === 'crystal') w.obj.rotation.y += dt * 0.2;
      if (w.kind === 'whale') {
        const tail = w.obj.getObjectByName('tail');
        if (tail) tail.rotation.y = Math.sin(t * 1.5 + w.z) * 0.4;
        w.obj.rotation.z = Math.sin(t * 0.5 + w.z) * 0.05;
      }
    }
  }
  shift(dx: number, dy: number) {
    for (const w of this.items) {
      w.x -= dx;
      w.y -= dy;
    }
  }
}

/** Other pilots' balloons drifting in the distance over the lowlands — a balloon festival. */
export class Festival {
  readonly group = new THREE.Group();
  private items: { obj: THREE.Object3D; x: number; y: number; z: number; vx: number; phase: number }[] = [];
  private rng = new Rng(5150);
  constructor(makeEnvelope: (i: number) => THREE.Object3D) {
    for (let i = 0; i < 12; i++) {
      const g = new THREE.Group();
      g.add(makeEnvelope(i));
      const basket = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 2.6), new THREE.MeshLambertMaterial({ color: '#8a5a2b' }));
      basket.position.y = 0.9;
      g.add(basket);
      const ropes = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.3, 3.2, 6, 1, true), new THREE.MeshBasicMaterial({ color: '#3d2b1f', wireframe: true }));
      ropes.position.y = 3.4;
      g.add(ropes);
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffae5c', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      flame.position.y = 4.6;
      flame.scale.setScalar(4);
      flame.name = 'flame';
      g.add(flame);
      this.group.add(g);
      const it = { obj: g, x: 0, y: 0, z: 0, vx: 0, phase: this.rng.range(0, 10) };
      this.items.push(it);
      this.place(it, 0, 0, true);
    }
  }
  private place(it: Festival['items'][number], cx: number, cy: number, anywhere: boolean, side = 0) {
    const r = this.rng;
    it.x = cx + (anywhere ? r.range(-450, 450) : side * 460);
    it.y = cy + r.range(-110, 180);
    it.z = r.range(-420, -110);
    it.vx = r.range(1, 4) * r.sign();
    it.obj.scale.setScalar(r.range(0.9, 1.3));
  }
  update(dt: number, t: number, cx: number, cy: number, alt: number, groundY: number) {
    const show = alt < 3500;
    this.group.visible = show;
    if (!show) return;
    for (const it of this.items) {
      it.x += it.vx * dt;
      it.y += Math.sin(t * 0.2 + it.phase) * dt * 1.5;
      if (it.x - cx > 470) this.place(it, cx, cy, false, -1);
      else if (it.x - cx < -470) this.place(it, cx, cy, false, 1);
      if (it.y - cy < -200) it.y += 380;
      if (it.y - cy > 260) it.y -= 380;
      it.obj.position.set(it.x, Math.max(groundY + 25, it.y), it.z);
      it.obj.rotation.z = Math.sin(t * 0.5 + it.phase) * 0.04;
      const flame = it.obj.getObjectByName('flame') as THREE.Sprite;
      flame.visible = Math.sin(t * 0.7 + it.phase * 3) > 0.4;
    }
  }
  shift(dx: number, dy: number) {
    for (const it of this.items) {
      it.x -= dx;
      it.y -= dy;
    }
  }
}
