import * as THREE from 'three';
import type { DisasterInstance } from '../disasters/disasters';
import type { Particles } from './particles';
import { makeCloudGeometry } from './clouds';
import { Rng } from '../core/rng';
import { glowTexture } from './textures';
import { PHYSICS } from '../../data/config';

/** Camera-facing (XY plane) ribbon for lightning bolts and energy arcs. */
export class Ribbon {
  readonly mesh: THREE.Mesh;
  private pos: Float32Array;
  private max: number;
  constructor(maxPoints: number, color: string, opacity = 1) {
    this.max = maxPoints;
    this.pos = new Float32Array(maxPoints * 2 * 3);
    const idx: number[] = [];
    for (let i = 0; i < maxPoints - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
  }
  set(points: THREE.Vector2[], width: number, z = 2) {
    const n = Math.min(points.length, this.max);
    for (let i = 0; i < this.max; i++) {
      const p = points[Math.min(i, n - 1)];
      const q = points[Math.min(i + 1, n - 1)];
      const pp = points[Math.max(0, Math.min(i, n - 1) - 1)];
      let dx = q.x - pp.x;
      let dy = q.y - pp.y;
      const l = Math.hypot(dx, dy) || 1;
      dx /= l;
      dy /= l;
      const w = width * (i >= n - 1 ? 0.3 : 1);
      this.pos.set([p.x - dy * w, p.y + dx * w, z, p.x + dy * w, p.y - dx * w, z], i * 6);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
  set opacity(v: number) {
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = v;
  }
}

export function jagged(x0: number, y0: number, x1: number, y1: number, segments: number, jitter: number, rng: () => number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const j = i === 0 || i === segments ? 0 : (rng() - 0.5) * jitter;
    const nx = -(y1 - y0);
    const ny = x1 - x0;
    const l = Math.hypot(nx, ny) || 1;
    pts.push(new THREE.Vector2(x0 + (x1 - x0) * t + (nx / l) * j, y0 + (y1 - y0) * t + (ny / l) * j));
  }
  return pts;
}

const columnShader = (color: string, down: boolean) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; uniform float uAlpha; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float streak = 0.5 + 0.5*sin(vUv.x*40.0 + sin(vUv.y*9.0)*2.0) * sin((vUv.y*${down ? '18.0 + uTime*9.0' : '14.0 - uTime*4.0'}));
        float edge = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
        gl_FragColor = vec4(uColor, uAlpha * edge * (0.45 + 0.55*streak));
      }`,
  });

const funnelShader = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
    vertexShader: `varying vec2 vUv; uniform float uTime; void main(){ vUv = uv; vec3 p = position; float a = uTime*0.6 + uv.y*3.0; p.x += sin(a)*uv.y*0.12; p.z += cos(a)*uv.y*0.08; gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader: `uniform float uTime; uniform float uAlpha; varying vec2 vUv;
      void main(){
        float sw = sin(vUv.x*6.2831*5.0 + vUv.y*14.0 - uTime*7.0);
        float sw2 = sin(vUv.x*6.2831*11.0 - vUv.y*25.0 - uTime*11.0);
        float a = 0.55 + 0.25*sw + 0.2*sw2;
        vec3 c = mix(vec3(0.38,0.33,0.28), vec3(0.78,0.72,0.62), 0.5+0.5*sw);
        float fade = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
        gl_FragColor = vec4(c, a*uAlpha*fade);
      }`,
  });

let cloudGeos: THREE.BufferGeometry[] | null = null;
const getCloudGeos = () => (cloudGeos ??= [0, 1, 2].map((i) => makeCloudGeometry(new Rng(900 + i), 7, 0.5)));

interface DView {
  group: THREE.Group;
  update(d: DisasterInstance, ox: number, oy: number, px: number, py: number, t: number, dt: number): void;
}

export interface DisasterFxHooks {
  particles: Particles;
  additive: Particles;
  flash(amount: number, x: number, y: number): void;
}

function stormCeiling(color: string, count: number, rng: Rng): { group: THREE.Group; mat: THREE.MeshLambertMaterial; update: (x: number, y: number, a: number) => void } {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color, vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
  const offs: [number, number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(getCloudGeos()[i % 3], mat);
    const s = rng.range(10, 18);
    m.scale.set(s, s * 0.6, s);
    group.add(m);
    offs.push([rng.range(-130, 130), rng.range(58, 82), rng.range(-90, -15), rng.range(0, 6)]);
  }
  return {
    group,
    mat,
    update: (x, y, a) => {
      mat.opacity = a * 0.95;
      group.visible = a > 0.01;
      group.children.forEach((c, i) => c.position.set(x + offs[i][0], y + offs[i][1], offs[i][2]));
    },
  };
}

export class DisasterViews {
  readonly group = new THREE.Group();
  private views = new Map<number, DView>();
  constructor(private fx: DisasterFxHooks, private onVolcano: (x: number | null) => void) {}

  sync(list: DisasterInstance[], ox: number, oy: number, px: number, py: number, t: number, dt: number) {
    const alive = new Set<number>();
    let volcanoX: number | null = null;
    for (const d of list) {
      alive.add(d.uid);
      let v = this.views.get(d.uid);
      if (!v) {
        v = this.create(d);
        this.views.set(d.uid, v);
        this.group.add(v.group);
      }
      v.update(d, ox, oy, px, py, t, dt);
      if (d.id === 'volcano') volcanoX = d.x;
    }
    for (const [uid, v] of this.views) {
      if (!alive.has(uid)) {
        this.group.remove(v.group);
        v.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.());
        this.views.delete(uid);
      }
    }
    this.onVolcano(volcanoX);
  }

  clear() {
    this.sync([], 0, 0, 0, 0, 0, 0);
  }

  private create(d: DisasterInstance): DView {
    const rng = new Rng(d.seed);
    const group = new THREE.Group();
    const fx = this.fx;
    switch (d.id) {
      case 'thunderstorm':
      case 'supercell': {
        const ceiling = stormCeiling(d.id === 'supercell' ? '#3a3f55' : '#5a6070', d.id === 'supercell' ? 20 : 13, rng);
        group.add(ceiling.group);
        const hot = new Map<number, { ring: THREE.Mesh; glow: THREE.Sprite; bolt?: Ribbon; boltGlow?: Ribbon; fired: boolean }>();
        return {
          group,
          update: (d, ox, oy, px, py, t, dt) => {
            ceiling.update(px, py, d.presence);
            const seen = new Set<number>();
            for (const s of d.strikes) {
              seen.add(s.id);
              let h = hot.get(s.id);
              if (!h) {
                const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32), new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
                const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#fff3b0', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
                group.add(ring, glow);
                h = { ring, glow, fired: false };
                hot.set(s.id, h);
              }
              const x = s.x - ox;
              const y = s.y - oy;
              if (s.fuse > 0) {
                const k = 1 - s.fuse / s.maxFuse;
                h.ring.position.set(x, y, 1);
                h.ring.scale.setScalar(s.r * (1.6 - k * 0.6));
                (h.ring.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.6 * k * (0.6 + 0.4 * Math.sin(t * (10 + k * 30)));
                h.glow.position.set(x, y, 1);
                h.glow.scale.setScalar(s.r * (0.8 + k * 1.6));
                (h.glow.material as THREE.SpriteMaterial).opacity = 0.25 + k * 0.6;
                if (Math.random() < dt * 20 * k) fx.additive.emit({ x: x + (Math.random() - 0.5) * s.r * 2, y: y + (Math.random() - 0.5) * s.r * 2, count: 1, speed: 6, life: 0.2, size: 1.2, color: '#fff7c2' });
              } else {
                h.ring.visible = false;
                if (!h.fired) {
                  h.fired = true;
                  const pts = jagged(x + rng.range(-10, 10), y + 110, x, y, 22, 7, () => rng.next());
                  h.boltGlow = new Ribbon(23, '#7aa7ff', 0.5);
                  h.bolt = new Ribbon(23, '#ffffff', 1);
                  h.boltGlow.set(pts, 2.2, 3);
                  h.bolt.set(pts, 0.55, 3.1);
                  group.add(h.boltGlow.mesh, h.bolt.mesh);
                  // a branch
                  const mid = pts[Math.floor(pts.length * 0.45)];
                  const br = new Ribbon(10, '#dfe9ff', 0.8);
                  br.set(jagged(mid.x, mid.y, mid.x + rng.range(-20, 20), mid.y - rng.range(12, 25), 9, 4, () => rng.next()), 0.3, 3);
                  group.add(br.mesh);
                  h.glow.userData.branch = br;
                  fx.flash(1, x, y);
                  fx.additive.emit({ x, y, count: 40, speed: 22, life: 0.5, size: 1.6, color: '#ffffff', color2: '#9fc5ff', drag: 2 });
                }
                const a = Math.max(0, s.struck / 0.35) * (0.6 + 0.4 * Math.sin(t * 80));
                if (h.bolt) h.bolt.opacity = a;
                if (h.boltGlow) h.boltGlow.opacity = a * 0.6;
                const br = h.glow.userData.branch as Ribbon | undefined;
                if (br) br.opacity = a * 0.8;
                (h.glow.material as THREE.SpriteMaterial).opacity = a;
                h.glow.scale.setScalar(s.r * 4);
              }
            }
            for (const [id, h] of hot) {
              if (!seen.has(id)) {
                for (const o of [h.ring, h.glow, h.bolt?.mesh, h.boltGlow?.mesh, (h.glow.userData.branch as Ribbon | undefined)?.mesh]) if (o) group.remove(o);
                hot.delete(id);
              }
            }
          },
        };
      }
      case 'tornado': {
        const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.25, 1, 32, 24, true).translate(0, 0.5, 0), funnelShader());
        group.add(funnel);
        const cap = stormCeiling('#4b4840', 12, rng);
        group.add(cap.group);
        return {
          group,
          update: (d, ox, oy, px, py, t, dt) => {
            const x = d.x - ox;
            const top = d.width * 4.2 + 10;
            funnel.position.set(x, py - 160, -6);
            funnel.scale.set(top, 320, top * 0.7);
            const m = funnel.material as THREE.ShaderMaterial;
            m.uniforms.uTime.value = t;
            m.uniforms.uAlpha.value = Math.min(1, d.presence * 1.2) * (d.radius > 0 ? 1 : 0.3);
            cap.update(x, py, d.presence);
            cap.group.children.forEach((c) => (c.position.x = x + (c.position.x - x) * 0.6));
            // spiralling dust and debris within the suction radius
            if (d.phase !== 'done' && Math.random() < dt * 40 * d.presence) {
              const a = Math.random() * Math.PI * 2;
              const r = d.radius * (0.4 + Math.random() * 0.6);
              const yy = py + (Math.random() - 0.3) * 80;
              fx.particles.emit({ x: x + Math.cos(a) * r, y: yy, z: Math.sin(a) * r * 0.3, vx: -Math.cos(a) * 14, vz: Math.sin(a) * 10, vy: 2, count: 1, speed: 1, life: 2, size: 2.4, sizeEnd: 4, color: '#a08f75', alpha: 0.5, drag: 0.2 });
            }
            if (Math.random() < dt * 12 * d.presence) {
              const yy = py + (Math.random() - 0.3) * 90;
              const a = t * 3 + Math.random() * 6;
              fx.particles.emit({ x: x + Math.cos(a) * d.width * 1.5, y: yy, vx: -Math.sin(a) * 20, vy: 3, count: 1, speed: 2, life: 1, size: 1, color: '#5a4636', drag: 0 });
            }
          },
        };
      }
      case 'hurricane': {
        const bands: THREE.Mesh[] = [];
        for (let i = 0; i < 7; i++) {
          const b = new THREE.Mesh(new THREE.PlaneGeometry(600, 1), new THREE.MeshBasicMaterial({ color: '#7dffd8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
          bands.push(b);
          group.add(b);
          for (const e of [-1, 1]) {
            const edge = new THREE.Mesh(new THREE.PlaneGeometry(600, 0.35), new THREE.MeshBasicMaterial({ color: '#b8fff0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
            edge.userData.edge = e;
            b.add(edge);
          }
        }
        const ceiling = stormCeiling('#55606e', 10, rng);
        group.add(ceiling.group);
        return {
          group,
          update: (d, ox, oy, px, py, t) => {
            ceiling.update(px, py, d.presence * 0.8);
            const base = d.corridorBase - oy;
            const n0 = Math.round((py - base) / d.corridorSpacing) - 3;
            bands.forEach((b, i) => {
              const y = base + (n0 + i) * d.corridorSpacing;
              b.position.set(px, y, -8);
              b.scale.y = d.corridorHalf * 2;
              const a = d.presence * (0.07 + 0.03 * Math.sin(t * 2 + i));
              (b.material as THREE.MeshBasicMaterial).opacity = a;
              for (const e of b.children) {
                e.position.y = (e.userData.edge as number) * 0.5;
                e.scale.y = 1 / (d.corridorHalf * 2);
                ((e as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = d.presence * 0.5;
              }
            });
          },
        };
      }
      case 'hailstorm': {
        const ceiling = stormCeiling('#6b7385', 12, rng);
        group.add(ceiling.group);
        const cols: THREE.Mesh[] = [];
        return {
          group,
          update: (d, ox, oy, px, py, t, dt) => {
            ceiling.update(px, py, d.presence);
            while (cols.length < d.shafts.length) {
              const c = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), columnShader('#dfefff', true));
              cols.push(c);
              group.add(c);
            }
            d.shafts.forEach((s, i) => {
              const c = cols[i];
              const x = s.x - ox;
              const warm = Math.min(1, s.warm / 1.5);
              c.position.set(x, py + 20, -1);
              c.scale.set(s.w, 160, 1);
              const m = c.material as THREE.ShaderMaterial;
              m.uniforms.uTime.value = t;
              m.uniforms.uAlpha.value = d.presence * (warm < 1 ? 0.12 + 0.12 * Math.sin(t * 16) : 0.32);
              const rate = (warm < 1 ? 6 : 50) * d.presence * (d.phase === 'active' ? 1 : 0.3);
              if (Math.random() < dt * rate) {
                for (let k = 0; k < 3; k++)
                  fx.particles.emit({ x: x + (Math.random() - 0.5) * s.w, y: py + 70, z: (Math.random() - 0.5) * 10, vy: -55, count: 1, speed: 1, life: 2.4, size: 0.9, sizeEnd: 0.9, color: '#f4fbff', drag: 0 });
              }
            });
          },
        };
      }
      case 'volcano': {
        const col = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), columnShader('#3b3330', false));
        group.add(col);
        return {
          group,
          update: (d, ox, _oy, px, py, t, dt) => {
            const x = d.x - ox;
            col.position.set(x, py, -3);
            col.scale.set(d.width * 1.4, 320, 1);
            const m = col.material as THREE.ShaderMaterial;
            m.uniforms.uTime.value = t;
            m.uniforms.uAlpha.value = d.presence * (d.phase === 'warning' ? 0.25 : 0.75);
            const rate = d.phase === 'warning' ? 8 : 45;
            if (Math.random() < dt * rate * d.presence) {
              fx.particles.emit({ x: x + (Math.random() - 0.5) * d.width, y: py - 60, z: (Math.random() - 0.5) * 8, vy: 22, count: 2, speed: 3, life: 6, size: 5, sizeEnd: 11, color: '#4a403a', color2: '#2b2522', alpha: 0.75, drag: 0.1 });
              fx.additive.emit({ x: x + (Math.random() - 0.5) * d.width, y: py - 50, vy: 28, count: 2, speed: 6, life: 3, size: 0.9, color: '#ff7b00', color2: '#ffd166', drag: 0.1 });
            }
            void px;
          },
        };
      }
      case 'iceStorm': {
        const mk = () => new THREE.Mesh(new THREE.PlaneGeometry(700, 1.2), new THREE.MeshBasicMaterial({ color: '#a8e6ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        const top = mk();
        const bot = mk();
        const fill = new THREE.Mesh(new THREE.PlaneGeometry(700, 1), new THREE.MeshBasicMaterial({ color: '#cdeeff', transparent: true, opacity: 0, depthWrite: false }));
        group.add(top, bot, fill);
        return {
          group,
          update: (d, _ox, oy, px, py, t, dt) => {
            const yt = d.bandTop - oy;
            const yb = d.bandBottom - oy;
            top.position.set(px, yt, -6);
            bot.position.set(px, yb, -6);
            fill.position.set(px, (yt + yb) / 2, -40);
            fill.scale.y = yt - yb;
            const a = d.presence;
            (top.material as THREE.MeshBasicMaterial).opacity = a * (0.5 + 0.3 * Math.sin(t * 3));
            (bot.material as THREE.MeshBasicMaterial).opacity = a * 0.4;
            (fill.material as THREE.MeshBasicMaterial).opacity = a * 0.13;
            if (Math.random() < dt * 30 * a && py + PHYSICS.envelopeOffsetY > yb - 40 && py < yt + 40) {
              fx.additive.emit({ x: px + (Math.random() - 0.5) * 120, y: py + 50, z: (Math.random() - 0.5) * 40, vy: -8, vx: 4, count: 2, speed: 2, life: 5, size: 0.7, color: '#ffffff', drag: 0 });
            }
          },
        };
      }
      case 'microburst': {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.3, 1, 24, 1, true), columnShader('#c5cde8', true));
        group.add(col);
        const ceiling = stormCeiling('#3d4458', 9, rng);
        group.add(ceiling.group);
        return {
          group,
          update: (d, ox, _oy, _px, py, t, dt) => {
            const x = d.x - ox;
            col.position.set(x, py + 10, -2);
            col.scale.set(d.width / 2, 200, d.width / 4);
            const m = col.material as THREE.ShaderMaterial;
            m.uniforms.uTime.value = t * (d.phase === 'active' ? 2.5 : 0.8);
            m.uniforms.uAlpha.value = d.phase === 'warning' ? d.presence * (0.35 + 0.25 * Math.sin(t * 8)) : d.presence * 0.55;
            ceiling.update(x, py - 10, d.presence);
            ceiling.group.children.forEach((c) => (c.position.x = x + (c.position.x - x) * 0.25));
            if (d.phase === 'active' && Math.random() < dt * 40) {
              fx.particles.emit({ x: x + (Math.random() - 0.5) * d.width * 0.8, y: py + 60, vy: -45, count: 2, speed: 2, life: 2, size: 1.6, color: '#d7ddf0', alpha: 0.5, drag: 0 });
            }
          },
        };
      }
      case 'dustStorm': {
        const wall = stormCeiling('#c79a63', 18, rng);
        group.add(wall.group);
        return {
          group,
          update: (d, _ox, oy, px, py, _t, dt) => {
            const top = d.bandTop - oy;
            wall.update(px, top - 70, d.presence);
            wall.mat.opacity = d.presence * 0.85;
            if (Math.random() < dt * 30 * d.presence) {
              fx.particles.emit({ x: px + (Math.random() - 0.5) * 140, y: Math.min(top, py + 30) - Math.random() * 40, z: (Math.random() - 0.5) * 30, vx: d.dir * 18, count: 2, speed: 2, life: 3, size: 4, sizeEnd: 8, color: '#c8a074', alpha: 0.35, drag: 0 });
            }
          },
        };
      }
      case 'windShear':
        return {
          group,
          update: (_d, _ox, _oy, px, py, _t, dt) => {
            if (Math.random() < dt * 20) fx.particles.emit({ x: px + (Math.random() - 0.5) * 100, y: py + (Math.random() - 0.3) * 60, vx: (Math.random() - 0.5) * 40, count: 1, speed: 1, life: 1, size: 1.6, color: '#e8fff0', alpha: 0.35 });
          },
        };
      case 'meteorShower':
        return {
          group,
          update: (_d, _ox, _oy, px, py, _t, dt) => {
            if (Math.random() < dt * 6) fx.additive.emit({ x: px + (Math.random() - 0.5) * 600, y: py + 150 + Math.random() * 120, z: -300, vx: -90, vy: -60, count: 1, speed: 0, life: 1.2, size: 5, sizeEnd: 1, color: '#ffd29d', drag: 0 });
          },
        };
      case 'energyStorm': {
        const arcs = new Map<number, { a: Ribbon; b: Ribbon; ga: THREE.Sprite; gb: THREE.Sprite }>();
        return {
          group,
          update: (d, ox, oy, _px, _py, t, dt) => {
            const seen = new Set<number>();
            for (const a of d.arcs) {
              seen.add(a.id);
              let v = arcs.get(a.id);
              if (!v) {
                const mk = () => new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#9ef0ff', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
                v = { a: new Ribbon(28, '#d9b3ff'), b: new Ribbon(28, '#d9b3ff'), ga: mk(), gb: mk() };
                group.add(v.a.mesh, v.b.mesh, v.ga, v.gb);
                arcs.set(a.id, v);
              }
              const y = a.y - oy;
              const g0 = a.gapX - a.gapW / 2 - ox;
              const g1 = a.gapX + a.gapW / 2 - ox;
              const tel = a.fuse > 0;
              const w = tel ? 0.25 : 0.9 + Math.sin(t * 50) * 0.3;
              const r = () => Math.random();
              if (a.gapW < 900) {
                v.a.set(jagged(a.x0 - ox, y, g0, y, 27, tel ? 1.5 : 4, r), w);
                v.b.set(jagged(g1, y, a.x1 - ox, y, 27, tel ? 1.5 : 4, r), w);
              } else v.a.set(jagged(a.x0 - ox, y, a.x1 - ox, y, 27, 6, r), w * 1.5);
              const op = tel ? 0.25 + 0.25 * Math.sin(t * 25) : Math.min(1, a.life * 2);
              v.a.opacity = op;
              v.b.opacity = a.gapW < 900 ? op : 0;
              v.ga.position.set(g0, y, 2);
              v.gb.position.set(g1, y, 2);
              v.ga.scale.setScalar(5);
              v.gb.scale.setScalar(5);
              (v.ga.material as THREE.SpriteMaterial).opacity = a.gapW < 900 ? op : 0;
              (v.gb.material as THREE.SpriteMaterial).opacity = a.gapW < 900 ? op : 0;
              if (!tel && Math.random() < dt * 10) fx.additive.emit({ x: g0 - Math.random() * 60, y, count: 2, speed: 8, life: 0.4, size: 1, color: '#e0aaff' });
            }
            for (const [id, v] of arcs) {
              if (!seen.has(id)) {
                group.remove(v.a.mesh, v.b.mesh, v.ga, v.gb);
                arcs.delete(id);
              }
            }
          },
        };
      }
    }
  }
}
