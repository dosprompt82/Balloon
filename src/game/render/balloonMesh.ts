import * as THREE from 'three';
import type { BalloonDef } from '../../data/balloons';
import { hashInts } from '../core/rng';
import { wickerTexture, glowTexture } from './textures';
import { CharacterRig } from './characterMesh';

const GORES = 16;
const SUB = 3;
const R = 7.5;
const CENTER = 13;
const THROAT_Y = 5;
const THROAT_R = 1.6;

/** Envelope silhouette: a sphere cap blended into a curved taper down to the throat. */
function profile(): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const thetaJoin = (112 * Math.PI) / 180;
  const jx = R * Math.sin(thetaJoin);
  const jy = CENTER + R * Math.cos(thetaJoin);
  const tx = Math.cos(thetaJoin);
  const ty = -Math.sin(thetaJoin);
  const ctrl = new THREE.Vector2(jx + tx * 3.2, jy + ty * 3.2);
  const N1 = 14;
  for (let i = 0; i <= N1; i++) {
    const t = i / N1;
    const a = new THREE.Vector2(THROAT_R, THROAT_Y);
    // quadratic bezier from throat → join point
    const p = a.clone().multiplyScalar((1 - t) ** 2).add(ctrl.clone().multiplyScalar(2 * (1 - t) * t)).add(new THREE.Vector2(jx, jy).multiplyScalar(t * t));
    pts.push(p);
  }
  const N2 = 22;
  for (let i = 1; i <= N2; i++) {
    const th = thetaJoin * (1 - i / N2);
    pts.push(new THREE.Vector2(Math.max(0.001, R * Math.sin(th)), CENTER + R * Math.cos(th)));
  }
  return pts;
}

function patternColor(def: BalloonDef, gore: number, v: number, u: number, face: number, out: THREE.Color) {
  const c = def.colors;
  const n = c.length;
  let idx = 0;
  switch (def.pattern) {
    case 'stripes':
      idx = gore % n;
      if (v > 0.93) idx = 1;
      break;
    case 'sunburst':
      idx = v > 0.78 ? 1 : v > 0.42 && v < 0.5 ? 3 % n : gore % 2 === 0 ? 0 : 2 % n;
      break;
    case 'patchwork':
      idx = hashInts(gore * 7 + 3, Math.floor(v * 9)) % n;
      break;
    case 'zigzag': {
      const tri = Math.abs(((u * GORES * 2) % 2) - 1);
      idx = Math.floor(v * 7 + tri * 0.6) % n;
      break;
    }
    case 'stars': {
      out.set(c[0]).lerp(new THREE.Color(c[1]), Math.min(1, v * 1.3));
      if (v > 0.9) out.set(c[2]);
      if (hashInts(face, 99) % 37 === 0 && v < 0.88) out.set(c[3]);
      if (v > 0.44 && v < 0.48) out.set(c[3]);
      return;
    }
    case 'checker':
      idx = (gore + Math.floor(v * 7)) % 2;
      if (v > 0.3 && v < 0.36) idx = 2;
      break;
    case 'gradient': {
      const t = Math.min(0.999, v) * (n - 1);
      const i = Math.floor(t);
      out.set(c[i]).lerp(new THREE.Color(c[Math.min(n - 1, i + 1)]), t - i);
      if ((gore % 4 === 0) && v < 0.9) out.multiplyScalar(0.92);
      return;
    }
    case 'spiral':
      idx = Math.floor(u * GORES * 0.5 + v * 8) % n;
      break;
    case 'hyper': {
      // chrome cap and skirt with racing chevrons in between
      if (v > 0.86 || v < 0.12) {
        out.set('#d9e2ec').lerp(new THREE.Color('#7b8794'), (gore % 2) * 0.4);
        return;
      }
      const chev = Math.abs(((u * GORES) % 2) - 1);
      idx = Math.floor(v * 10 + chev * 1.5) % n;
      if (Math.abs(v - 0.5) < 0.025) {
        out.set('#ffffff');
        return;
      }
      break;
    }
  }
  out.set(c[idx % n]);
}

export function buildEnvelope(def: BalloonDef): THREE.Group {
  const g = new THREE.Group();
  const prof = profile();
  const lathe = new THREE.LatheGeometry(prof, GORES * SUB);
  // scallop each gore so panels bulge between seams
  const pos = lathe.attributes.position;
  const uv = lathe.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    const within = (u * GORES) % 1;
    const bulge = Math.sin(within * Math.PI) * 0.045 * Math.sin(Math.min(1, v * 1.1) * Math.PI);
    pos.setX(i, pos.getX(i) * (1 + bulge));
    pos.setZ(i, pos.getZ(i) * (1 + bulge));
  }
  const geo = lathe.toNonIndexed();
  const p2 = geo.attributes.position;
  const uv2 = geo.attributes.uv;
  const colors = new Float32Array(p2.count * 3);
  const col = new THREE.Color();
  for (let f = 0; f < p2.count; f += 3) {
    const u = (uv2.getX(f) + uv2.getX(f + 1) + uv2.getX(f + 2)) / 3;
    const v = (uv2.getY(f) + uv2.getY(f + 1) + uv2.getY(f + 2)) / 3;
    const gore = Math.floor(u * GORES) % GORES;
    patternColor(def, gore, v, u, f / 3, col);
    // subtle vertical shading so lower fabric looks shadowed
    const shade = 0.82 + 0.18 * Math.min(1, v * 1.4);
    for (let k = 0; k < 3; k++) colors.set([col.r * shade, col.g * shade, col.b * shade], (f + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.02, side: THREE.DoubleSide, emissive: new THREE.Color('#000000') });
  const env = new THREE.Mesh(geo, mat);
  env.castShadow = true;
  env.name = 'envelope';
  g.add(env);

  // seams (gore boundaries) and horizontal load tapes
  const seamPts: number[] = [];
  for (let s = 0; s < GORES; s++) {
    const a = (s / GORES) * Math.PI * 2;
    for (let i = 0; i < prof.length - 1; i++) {
      const p0 = prof[i];
      const p1 = prof[i + 1];
      seamPts.push(Math.sin(a) * p0.x * 1.003, p0.y, Math.cos(a) * p0.x * 1.003, Math.sin(a) * p1.x * 1.003, p1.y, Math.cos(a) * p1.x * 1.003);
    }
  }
  for (const ti of [3, 6, 10, 14, 19, 24, 28, 31, 34]) {
    const p = prof[ti];
    for (let s = 0; s < GORES * SUB; s++) {
      const a0 = (s / (GORES * SUB)) * Math.PI * 2;
      const a1 = ((s + 1) / (GORES * SUB)) * Math.PI * 2;
      const r = p.x * 1.03;
      seamPts.push(Math.sin(a0) * r, p.y, Math.cos(a0) * r, Math.sin(a1) * r, p.y, Math.cos(a1) * r);
    }
  }
  const seamGeo = new THREE.BufferGeometry();
  seamGeo.setAttribute('position', new THREE.Float32BufferAttribute(seamPts, 3));
  const seams = new THREE.LineSegments(seamGeo, new THREE.LineBasicMaterial({ color: '#2b2118', transparent: true, opacity: 0.35 }));
  g.add(seams);

  // skirt / scoop and crown ring
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(THROAT_R * 1.02, THROAT_R * 0.9, 1.1, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(def.colors[0]).multiplyScalar(0.7), side: THREE.DoubleSide, roughness: 0.8 }),
  );
  skirt.position.y = THROAT_Y - 0.5;
  g.add(skirt);
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.14, 6, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d9d9d9', metalness: 0.6, roughness: 0.4 }));
  crown.position.y = CENTER + R - 0.05;
  g.add(crown);
  // gold equator trim with rivets
  const gold = new THREE.MeshStandardMaterial({ color: '#e9c46a', metalness: 0.7, roughness: 0.3 });
  const eq = prof[24];
  const trim = new THREE.Mesh(new THREE.TorusGeometry(eq.x * 1.035, 0.13, 6, 64).rotateX(Math.PI / 2), gold);
  trim.position.y = eq.y;
  g.add(trim);
  for (let i = 0; i < GORES; i++) {
    const a = (i / GORES) * Math.PI * 2;
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 4), gold);
    rivet.position.set(Math.sin(a) * eq.x * 1.05, eq.y, Math.cos(a) * eq.x * 1.05);
    g.add(rivet);
  }
  // parachute vent panel visible from above
  const vent = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: new THREE.Color(def.colors[1 % def.colors.length]), side: THREE.DoubleSide }));
  vent.position.y = CENTER + R + 0.02;
  g.add(vent);
  return g;
}

export interface BalloonVisualState {
  heat: number;
  burning: boolean;
  boosting: boolean;
  venting: boolean;
  steer: number;
  ice: number;
  shield: number;
  rod: number;
  fans: boolean;
  deflate: number;
  sandbags: number;
}

/** Full balloon: envelope, ropes, swinging basket, burner, crew and gadgets. */
export class BalloonView {
  readonly root = new THREE.Group();
  readonly envelopeGroup: THREE.Group;
  readonly basketPivot = new THREE.Group();
  readonly basket = new THREE.Group();
  readonly character: CharacterRig;
  private ropes: THREE.Mesh[] = [];
  private flame: THREE.Mesh;
  private flameInner: THREE.Mesh;
  private flameGlow: THREE.Sprite;
  readonly flameLight: THREE.PointLight;
  private shield: THREE.Mesh;
  private rod: THREE.Group;
  private fans: THREE.Group[] = [];
  private icicles: THREE.Group;
  private sandbags: THREE.Mesh[] = [];
  private envMat: THREE.MeshStandardMaterial;
  private pennant!: THREE.Mesh;
  private hyperParts: THREE.Group | null = null;
  private boosterFlames: THREE.Mesh[] = [];
  private rings: THREE.Mesh[] = [];
  private swing = 0;
  private swingVel = 0;
  private tilt = 0;
  private lastVx = 0;
  def: BalloonDef;

  constructor(def: BalloonDef, character: CharacterRig) {
    this.def = def;
    this.envelopeGroup = buildEnvelope(def);
    this.envMat = (this.envelopeGroup.getObjectByName('envelope') as THREE.Mesh).material as THREE.MeshStandardMaterial;
    this.root.add(this.envelopeGroup);
    this.basketPivot.position.y = THROAT_Y;
    this.root.add(this.basketPivot);
    this.basket.position.y = -THROAT_Y;
    this.basketPivot.add(this.basket);

    // wicker basket with padded rim
    const wicker = new THREE.MeshStandardMaterial({ map: wickerTexture(), roughness: 0.95 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.9, 2.8, 2, 2, 2), wicker);
    box.position.y = 0.95;
    box.castShadow = true;
    this.basket.add(box);
    const rimMat = new THREE.MeshStandardMaterial({ color: '#5b3a1e', roughness: 0.7 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.16, 6, 4).rotateX(Math.PI / 2).rotateY(Math.PI / 4), rimMat);
    rim.position.y = 1.9;
    rim.scale.set(1.02, 1, 1.02);
    this.basket.add(rim);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 3), rimMat);
    floor.position.y = 0.05;
    this.basket.add(floor);

    // burner frame & burner
    const metal = new THREE.MeshStandardMaterial({ color: '#9aa5b1', metalness: 0.8, roughness: 0.3 });
    for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 5), metal);
      const from = new THREE.Vector3(x * 1.05, 1.9, z * 1.05);
      const to = new THREE.Vector3(x * 0.3, 3.75, z * 0.3);
      post.position.copy(from).add(to).multiplyScalar(0.5);
      post.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
      post.scale.y = from.distanceTo(to) / 1.9;
      this.basket.add(post);
    }
    const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.5, 10), metal);
    burner.position.y = 3.75;
    this.basket.add(burner);
    // corner posts, leather handles and a pennant on the burner frame
    const leather = new THREE.MeshStandardMaterial({ color: '#3d2614', roughness: 0.8 });
    for (const [x, z] of [[-1.35, -1.35], [1.35, -1.35], [-1.35, 1.35], [1.35, 1.35]]) {
      const cp = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2, 6), leather);
      cp.position.set(x, 1, z);
      this.basket.add(cp);
    }
    for (const s of [-1, 1]) {
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 5, 10, Math.PI), leather);
      handle.position.set(s * 1.42, 1.35, 0);
      handle.rotation.y = Math.PI / 2;
      handle.rotation.z = Math.PI;
      this.basket.add(handle);
    }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4), metal);
    pole.position.set(1.15, 2.7, 1.15);
    this.basket.add(pole);
    this.pennant = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 3).rotateZ(-Math.PI / 2).scale(1, 1, 0.15), new THREE.MeshStandardMaterial({ color: def.colors[0], side: THREE.DoubleSide }));
    this.pennant.position.set(1.75, 3.3, 1.15);
    this.basket.add(this.pennant);
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.8, 4, 8), new THREE.MeshStandardMaterial({ color: '#e63946', roughness: 0.5 }));
    tank.position.set(0.95, 1.5, -0.95);
    this.basket.add(tank);

    const flameMat = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.8, 10, 1, true).translate(0, 0.9, 0), flameMat);
    this.flame.position.y = 4;
    this.basket.add(this.flame);
    this.flameInner = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.1, 8, 1, true).translate(0, 0.55, 0), new THREE.MeshBasicMaterial({ color: '#7fd6ff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flameInner.position.y = 4;
    this.basket.add(this.flameInner);
    this.flameGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffaa55', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flameGlow.position.y = 4.6;
    this.flameGlow.scale.setScalar(4);
    this.basket.add(this.flameGlow);
    this.flameLight = new THREE.PointLight('#ffad5c', 0, 26, 1.5);
    this.flameLight.position.y = 5.2;
    this.basket.add(this.flameLight);

    // sandbags
    for (let i = 0; i < 6; i++) {
      const bag = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6).scale(1, 1.3, 0.8), new THREE.MeshStandardMaterial({ color: '#9c7b4f', roughness: 1 }));
      const side = i % 4;
      const off = (Math.floor(i / 4) - 0.3) * 0.9;
      const p = [[1.55, off], [-1.55, -off], [off, 1.55], [-off, -1.55]][side];
      bag.position.set(p[0], 0.75, p[1]);
      this.basket.add(bag);
      this.sandbags.push(bag);
    }

    // side fans
    for (const sx of [-1, 1]) {
      const fan = new THREE.Group();
      const housing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 6, 16).rotateY(Math.PI / 2), metal);
      fan.add(housing);
      const blades = new THREE.Group();
      blades.name = 'blades';
      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.85, 0.18), new THREE.MeshStandardMaterial({ color: '#333a40' }));
        blade.rotation.x = (b / 3) * Math.PI * 2;
        blades.add(blade);
      }
      fan.add(blades);
      fan.position.set(sx * 1.85, 1.2, 0);
      this.basket.add(fan);
      this.fans.push(fan);
    }

    // lightning rod
    this.rod = new THREE.Group();
    const rodPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7, 6), new THREE.MeshStandardMaterial({ color: '#c0a060', metalness: 0.9, roughness: 0.2 }));
    rodPole.position.y = 3.5;
    this.rod.add(rodPole);
    const tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#9fdcff', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    tip.position.y = 7.2;
    tip.scale.setScalar(2.5);
    tip.name = 'tip';
    this.rod.add(tip);
    this.rod.position.set(-1.3, 1.9, -1.3);
    this.rod.rotation.z = 0.35;
    this.basket.add(this.rod);

    // icicles
    this.icicles = new THREE.Group();
    const iceMat = new THREE.MeshStandardMaterial({ color: '#dff6ff', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 14; i++) {
      const ic = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.7 + (i % 3) * 0.3, 5).rotateX(Math.PI), iceMat);
      const a = (i / 14) * Math.PI * 2;
      ic.position.set(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5);
      this.icicles.add(ic);
    }
    this.basket.add(this.icicles);

    // ropes: throat ring → basket corners
    const ropeMat = new THREE.MeshStandardMaterial({ color: '#4a3b2a', roughness: 1 });
    for (let i = 0; i < 8; i++) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 4).translate(0, 0.5, 0), ropeMat);
      this.root.add(rope);
      this.ropes.push(rope);
    }

    // shield bubble
    this.shield = new THREE.Mesh(
      new THREE.SphereGeometry(12, 32, 20),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
        vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `uniform float uTime; uniform float uAlpha; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); float hex = 0.5 + 0.5*sin(vP.y*2.0 + uTime*3.0)*sin(vP.x*2.0 - uTime*2.0); gl_FragColor = vec4(vec3(0.45,0.85,1.0)*(f*1.4 + hex*0.12), (f*0.9 + 0.05)*uAlpha); }`,
      }),
    );
    this.shield.position.y = 9;
    this.root.add(this.shield);

    if (def.id === 'hyper') this.buildHyper(metal);

    this.character = character;
    character.group.position.set(-0.15, 0.55, 0.35);
    character.group.scale.setScalar(1);
    this.basket.add(character.group);
    this.setScale(def.scale);
  }

  private buildHyper(metal: THREE.Material) {
    const g = new THREE.Group();
    this.hyperParts = g;
    const chrome = new THREE.MeshStandardMaterial({ color: '#cfd8e3', metalness: 0.95, roughness: 0.15 });
    const neon = ['#ff006e', '#3a86ff', '#ffbe0b', '#06d6a0'];
    // four rocket boosters strapped under the basket
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const b = new THREE.Group();
      b.position.set(Math.cos(a) * 1.9, 0.4, Math.sin(a) * 1.9);
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 1.6, 4, 12), chrome);
      b.add(body);
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.25, 12), new THREE.MeshBasicMaterial({ color: neon[i] }));
      stripe.position.y = 0.3;
      b.add(stripe);
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 0.5, 12, 1, true), metal);
      nozzle.position.y = -1.2;
      b.add(nozzle);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.7), new THREE.MeshStandardMaterial({ color: neon[i] }));
      fin.position.set(Math.cos(a) * 0.4, -0.7, Math.sin(a) * 0.4);
      fin.rotation.y = -a;
      b.add(fin);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 3, 10, 1, true).rotateX(Math.PI).translate(0, -1.5, 0), new THREE.MeshBasicMaterial({ color: '#7fdcff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      flame.position.y = -1.4;
      b.add(flame);
      this.boosterFlames.push(flame);
      g.add(b);
    }
    // spinning neon halo rings around the envelope
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(9.6 + i * 1.4, 0.18, 8, 80), new THREE.MeshBasicMaterial({ color: neon[i], transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.position.y = 13;
      ring.rotation.x = Math.PI / 2 + (i ? 0.35 : -0.35);
      this.root.add(ring);
      this.rings.push(ring);
    }
    // chrome wings on the basket
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 1.2), chrome);
      wing.position.set(s * 2.9, 1.4, -0.3);
      wing.rotation.z = s * 0.25;
      g.add(wing);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 1.1), new THREE.MeshBasicMaterial({ color: neon[s > 0 ? 0 : 1] }));
      tip.position.set(s * 4.45, 1.85, -0.3);
      g.add(tip);
    }
    this.basket.add(g);
  }

  setScale(s: number) {
    this.envelopeGroup.scale.setScalar(s);
    this.basketPivot.position.y = THROAT_Y * s;
    this.basket.position.y = -THROAT_Y * s;
    this.shield.scale.setScalar(s);
  }

  /** Per-frame visual update. vx is lateral speed; dt real frame time. */
  update(dt: number, time: number, vx: number, vy: number, st: BalloonVisualState) {
    // envelope leans into lateral acceleration; basket swings as a damped pendulum
    const ax = (vx - this.lastVx) / Math.max(dt, 1e-3);
    this.lastVx = vx;
    const targetTilt = THREE.MathUtils.clamp(-vx * 0.012 - ax * 0.01, -0.3, 0.3) + Math.sin(time * 0.7) * 0.015;
    this.tilt += (targetTilt - this.tilt) * Math.min(1, dt * 2.5);
    this.envelopeGroup.rotation.z = this.tilt;
    this.envelopeGroup.rotation.x = Math.sin(time * 0.53) * 0.02;
    const k = 9;
    const c = 2.2;
    this.swingVel += (-k * (this.swing - this.tilt * 0.4) - c * this.swingVel + ax * 0.06) * dt;
    this.swing += this.swingVel * dt;
    this.swing = THREE.MathUtils.clamp(this.swing, -0.5, 0.5);
    this.basketPivot.rotation.z = this.swing;
    this.basketPivot.rotation.x = Math.sin(time * 0.9) * 0.025 + THREE.MathUtils.clamp(-vy * 0.004, -0.05, 0.05);
    this.basket.rotation.y = Math.sin(time * 0.31) * 0.08;

    // deflation when destroyed
    const d = st.deflate;
    this.envelopeGroup.scale.set(this.def.scale * (1 - d * 0.35), this.def.scale * (1 - d * 0.55), this.def.scale * (1 - d * 0.3));
    this.envelopeGroup.rotation.z += d * 0.6;

    // flame
    const fl = st.burning ? (st.boosting ? 1.6 : 1) : 0;
    const flick = 0.85 + Math.sin(time * 40) * 0.08 + Math.sin(time * 23) * 0.07;
    const s = THREE.MathUtils.lerp(this.flame.scale.y, fl * flick, Math.min(1, dt * 18));
    this.flame.scale.set(0.6 + s * 0.4, Math.max(0.001, s), 0.6 + s * 0.4);
    this.flameInner.scale.set(1, Math.max(0.001, s * 0.9), 1);
    this.flame.visible = this.flameInner.visible = s > 0.02;
    (this.flameGlow.material as THREE.SpriteMaterial).opacity = Math.min(1, s * 0.9);
    this.flameGlow.scale.setScalar(2 + s * 4);
    this.flameLight.intensity = s * 60;
    this.envMat.emissive.setRGB(0.25 * s, 0.1 * s, 0.02 * s);
    this.pennant.rotation.y = Math.sin(time * 7) * 0.35 - vx * 0.03;
    if (this.hyperParts) {
      // the whole envelope pulses through the rainbow
      this.envMat.emissive.setHSL((time * 0.25) % 1, 0.9, 0.04 + 0.03 * Math.sin(time * 6));
      for (const [i, r] of this.rings.entries()) {
        r.rotation.z += dt * (i ? -2.4 : 3.1);
        (r.material as THREE.MeshBasicMaterial).color.setHSL((time * 0.3 + i * 0.5) % 1, 1, 0.45);
      }
      for (const f of this.boosterFlames) {
        const len = (st.burning ? (st.boosting ? 2.2 : 1.4) : 0.35) * (0.85 + Math.random() * 0.3);
        f.scale.set(1, len, 1);
        (f.material as THREE.MeshBasicMaterial).color.setHSL(0.55 + Math.sin(time * 9) * 0.05, 1, 0.65);
      }
    }

    // ice tint
    const ice = Math.min(1, st.ice);
    this.icicles.visible = ice > 0.08;
    this.icicles.scale.set(1, ice * 1.5 + 0.2, 1);
    this.envMat.color.setRGB(1 + ice * 0.0, 1, 1).lerp(new THREE.Color('#d8f3ff'), ice * 0.55);

    // gadgets
    this.rod.visible = st.rod > 0;
    const tip = this.rod.getObjectByName('tip') as THREE.Sprite;
    tip.scale.setScalar(2 + Math.sin(time * 20) * 0.6);
    const sh = this.shield.material as THREE.ShaderMaterial;
    sh.uniforms.uTime.value = time;
    sh.uniforms.uAlpha.value = THREE.MathUtils.lerp(sh.uniforms.uAlpha.value, st.shield > 0 ? (st.shield < 1.5 ? 0.5 + 0.5 * Math.sin(time * 18) : 1) : 0, Math.min(1, dt * 6));
    this.shield.visible = sh.uniforms.uAlpha.value > 0.01;
    for (const [i, fan] of this.fans.entries()) {
      fan.visible = st.fans;
      const blades = fan.getObjectByName('blades')!;
      const dir = i === 0 ? 1 : -1;
      blades.rotation.x += dt * (6 + Math.max(0, st.steer * dir) * 40);
    }
    for (let i = 0; i < this.sandbags.length; i++) this.sandbags[i].visible = i < st.sandbags;

    this.updateRopes();
  }

  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private updateRopes() {
    this.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const s = this.def.scale;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      this.tmpA.set(Math.cos(a) * THROAT_R * 1.15 * s, (THROAT_Y - 0.9) * s, Math.sin(a) * THROAT_R * 1.15 * s);
      this.envelopeGroup.localToWorld(this.tmpA).applyMatrix4(inv);
      const corner = i % 2 === 0 ? 1.35 : 1.0;
      this.tmpB.set(Math.cos(a) * corner * 1.25, 1.95, Math.sin(a) * corner * 1.25);
      this.basket.localToWorld(this.tmpB).applyMatrix4(inv);
      const rope = this.ropes[i];
      rope.position.copy(this.tmpB);
      const dir = this.tmpA.clone().sub(this.tmpB);
      rope.scale.set(1, dir.length(), 1);
      rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    }
  }

  dispose() {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}
