import * as THREE from 'three';
import { glowTexture } from './textures';

export interface EmitOptions {
  x: number;
  y: number;
  z?: number;
  count?: number;
  spread?: number;
  speed?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  life?: number;
  size?: number;
  sizeEnd?: number;
  color?: string | THREE.Color;
  color2?: string | THREE.Color;
  gravity?: number;
  drag?: number;
  alpha?: number;
}

/** Pooled CPU particle system rendered as soft point sprites. */
export class Particles {
  readonly points: THREE.Points;
  private max: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private s0: Float32Array;
  private s1: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private a0: Float32Array;
  private cursor = 0;
  private geo: THREE.BufferGeometry;
  private c1 = new THREE.Color();
  private c2 = new THREE.Color();

  constructor(max: number, additive: boolean) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: glowTexture() }, uScale: { value: 400 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size * uScale / max(1.0, -mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uTex; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vC, t.a*vA); if (gl_FragColor.a < 0.01) discard; }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
  }

  setScale(viewportHeight: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = viewportHeight * 0.6;
  }

  emit(o: EmitOptions) {
    const n = o.count ?? 10;
    this.c1.set(o.color ?? '#ffffff');
    this.c2.set(o.color2 ?? o.color ?? '#ffffff');
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const sp = o.spread ?? 1;
      const speed = o.speed ?? 5;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 2 - 1);
      const r = Math.random();
      this.pos[i * 3] = o.x + (Math.random() - 0.5) * sp;
      this.pos[i * 3 + 1] = o.y + (Math.random() - 0.5) * sp;
      this.pos[i * 3 + 2] = (o.z ?? 0) + (Math.random() - 0.5) * sp;
      this.vel[i * 3] = (o.vx ?? 0) + Math.sin(ph) * Math.cos(th) * speed * r;
      this.vel[i * 3 + 1] = (o.vy ?? 0) + Math.cos(ph) * speed * r;
      this.vel[i * 3 + 2] = (o.vz ?? 0) + Math.sin(ph) * Math.sin(th) * speed * r;
      const t = Math.random();
      this.col[i * 3] = this.c1.r + (this.c2.r - this.c1.r) * t;
      this.col[i * 3 + 1] = this.c1.g + (this.c2.g - this.c1.g) * t;
      this.col[i * 3 + 2] = this.c1.b + (this.c2.b - this.c1.b) * t;
      const life = (o.life ?? 1) * (0.7 + Math.random() * 0.6);
      this.life[i] = life;
      this.maxLife[i] = life;
      this.s0[i] = o.size ?? 1;
      this.s1[i] = o.sizeEnd ?? (o.size ?? 1) * 0.3;
      this.grav[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 0.5;
      this.a0[i] = o.alpha ?? 1;
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      this.alpha[i] = this.a0[i] * Math.min(1, (1 - t) * 3) * Math.min(1, t * 10 + 0.2);
    }
    for (const k of ['position', 'color', 'size', 'alpha']) this.geo.attributes[k].needsUpdate = true;
  }

  shift(dx: number, dy: number) {
    for (let i = 0; i < this.max; i++) {
      this.pos[i * 3] -= dx;
      this.pos[i * 3 + 1] -= dy;
    }
  }

  clear() {
    this.life.fill(0);
  }
}

/** Streaky precipitation (rain, hail, snow, dust) that wraps around the camera. */
export class Precipitation {
  readonly lines: THREE.LineSegments;
  private count: number;
  private pos: Float32Array;
  private offs: Float32Array;
  private mat: THREE.LineBasicMaterial;
  amount = 0;
  vx = 0;
  vy = -60;
  length = 1.6;

  constructor(count: number) {
    this.count = count;
    this.pos = new Float32Array(count * 6);
    this.offs = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.offs[i * 3] = (Math.random() - 0.5) * 160;
      this.offs[i * 3 + 1] = (Math.random() - 0.5) * 120;
      this.offs[i * 3 + 2] = (Math.random() - 0.5) * 90 + 10;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.LineBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.5, depthWrite: false });
    this.lines = new THREE.LineSegments(geo, this.mat);
    this.lines.frustumCulled = false;
  }

  setColor(c: string, opacity: number) {
    this.mat.color.set(c);
    this.mat.opacity = opacity;
  }

  update(dt: number, cx: number, cy: number) {
    const visible = Math.floor(this.count * Math.min(1, this.amount));
    this.lines.visible = visible > 0;
    if (!visible) return;
    const len = this.length;
    const sp = Math.hypot(this.vx, this.vy) || 1;
    for (let i = 0; i < this.count; i++) {
      this.offs[i * 3] += this.vx * dt;
      this.offs[i * 3 + 1] += this.vy * dt;
      if (this.offs[i * 3 + 1] < -60) this.offs[i * 3 + 1] += 120;
      if (this.offs[i * 3 + 1] > 60) this.offs[i * 3 + 1] -= 120;
      if (this.offs[i * 3] < -80) this.offs[i * 3] += 160;
      if (this.offs[i * 3] > 80) this.offs[i * 3] -= 160;
      const x = cx + this.offs[i * 3];
      const y = cy + this.offs[i * 3 + 1];
      const z = this.offs[i * 3 + 2];
      const on = i < visible ? 1 : 0;
      this.pos[i * 6] = x;
      this.pos[i * 6 + 1] = y;
      this.pos[i * 6 + 2] = z;
      this.pos[i * 6 + 3] = x - (this.vx / sp) * len * on;
      this.pos[i * 6 + 4] = y - (this.vy / sp) * len * on;
      this.pos[i * 6 + 5] = z;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
}
