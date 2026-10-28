import * as THREE from 'three';
import type { ObstacleId } from '../../data/obstacles';
import type { CollectibleId } from '../../data/collectibles';
import { glowTexture, plankTexture } from './textures';

type Anim = (o: THREE.Object3D, t: number, dt: number) => void;

const lam = (c: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, flatShading: true, ...opts });
const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  return o;
};
const glow = (color: string, scale: number) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  s.scale.setScalar(scale);
  return s;
};

function bird(body: string, wing: string, size: number, goose = false): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.5, 8, 6).scale(1.8, 0.8, 0.8), lam(body)));
  g.add(mesh(new THREE.SphereGeometry(0.32, 8, 6), lam(goose ? '#1b1b1e' : body), 1.0, goose ? 0.45 : 0.15, 0));
  if (goose) g.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.7, 5).rotateZ(-0.7), lam('#1b1b1e'), 0.75, 0.2, 0));
  g.add(mesh(new THREE.ConeGeometry(0.12, 0.35, 5).rotateZ(-Math.PI / 2), lam('#ffb703'), 1.4, goose ? 0.45 : 0.15, 0));
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.4, 0, 0, 0.5, 0, 0, 0, 0, 1.8], 3));
  wingGeo.computeVertexNormals();
  const wm = new THREE.MeshStandardMaterial({ color: wing, side: THREE.DoubleSide, flatShading: true });
  const wl = new THREE.Mesh(wingGeo, wm);
  const wr = new THREE.Mesh(wingGeo, wm);
  wr.scale.z = -1;
  wl.name = 'wl';
  wr.name = 'wr';
  g.add(wl, wr);
  g.scale.setScalar(size);
  g.userData.anim = ((o, t) => {
    const f = Math.sin(t * 12 + o.id) * 0.7;
    o.getObjectByName('wl')!.rotation.x = f;
    o.getObjectByName('wr')!.rotation.x = -f;
  }) as Anim;
  return g;
}

function plane(): THREE.Object3D {
  const g = new THREE.Group();
  const red = lam('#e63946');
  const white = lam('#f1faee');
  g.add(mesh(new THREE.CapsuleGeometry(0.7, 4.5, 4, 10).rotateZ(Math.PI / 2), white));
  g.add(mesh(new THREE.BoxGeometry(1.6, 0.15, 9), red, 0.4, 0.2, 0));
  g.add(mesh(new THREE.BoxGeometry(1, 0.12, 3.2), red, -2.6, 0.2, 0));
  g.add(mesh(new THREE.BoxGeometry(1, 1.5, 0.12), red, -2.6, 0.9, 0));
  g.add(mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshStandardMaterial({ color: '#7fd6ff', metalness: 0.5, roughness: 0.1 }), 1.3, 0.55, 0));
  const prop = mesh(new THREE.BoxGeometry(0.08, 2.4, 0.25), lam('#333'), 3.05, 0, 0);
  prop.name = 'prop';
  g.add(prop);
  g.userData.anim = ((o, _t, dt) => {
    o.getObjectByName('prop')!.rotation.x += dt * 50;
  }) as Anim;
  return g;
}

function helicopter(): THREE.Object3D {
  const g = new THREE.Group();
  const body = lam('#ffb703');
  g.add(mesh(new THREE.SphereGeometry(1.4, 12, 10).scale(1.3, 1, 1), body));
  g.add(mesh(new THREE.SphereGeometry(0.9, 10, 8).scale(1, 0.8, 0.9), new THREE.MeshStandardMaterial({ color: '#8ecae6', metalness: 0.4, roughness: 0.1 }), 0.9, 0.2, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.35, 4, 6).rotateZ(Math.PI / 2), body, -2.8, 0.3, 0));
  g.add(mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), lam('#333'), -4.6, 0.6, 0.2));
  for (const z of [-0.8, 0.8]) g.add(mesh(new THREE.BoxGeometry(3, 0.1, 0.1), lam('#333'), 0, -1.5, z));
  const rotor = new THREE.Group();
  rotor.position.y = 1.6;
  rotor.add(mesh(new THREE.BoxGeometry(9, 0.06, 0.4), lam('#222')));
  rotor.add(mesh(new THREE.BoxGeometry(0.4, 0.06, 9), lam('#222')));
  rotor.name = 'rotor';
  g.add(rotor);
  g.userData.anim = ((o, _t, dt) => {
    o.getObjectByName('rotor')!.rotation.y += dt * 30;
  }) as Anim;
  return g;
}

function glider(): THREE.Object3D {
  const g = new THREE.Group();
  const w = lam('#ffffff');
  g.add(mesh(new THREE.CapsuleGeometry(0.35, 3.5, 4, 8).rotateZ(Math.PI / 2), w));
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.08, 13), w, 0.3, 0.2, 0));
  g.add(mesh(new THREE.BoxGeometry(0.7, 1.1, 0.08), lam('#118ab2'), -2.2, 0.6, 0));
  return g;
}

function weatherBalloon(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(3, 16, 12).scale(1, 1.1, 1), new THREE.MeshStandardMaterial({ color: '#f8f9fa', roughness: 0.3, transparent: true, opacity: 0.92 })));
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 4, 4), lam('#999'), 0, -5, 0));
  g.add(mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), lam('#ff9f1c'), 0, -7.2, 0));
  g.userData.anim = ((o, t) => {
    o.rotation.z = Math.sin(t * 0.8) * 0.08;
  }) as Anim;
  return g;
}

function drone(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.2, 0.35, 1.2), lam('#212529')));
  g.add(glow('#ff3b3b', 1.2));
  const rotors: THREE.Object3D[] = [];
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    g.add(mesh(new THREE.BoxGeometry(1.2, 0.08, 0.1).rotateY(Math.atan2(z, x)), lam('#444'), x * 0.6, 0, z * 0.6));
    const r = mesh(new THREE.BoxGeometry(1.1, 0.03, 0.12), lam('#999'), x * 1.1, 0.25, z * 1.1);
    rotors.push(r);
    g.add(r);
  }
  g.userData.anim = ((_o, _t, dt) => {
    for (const r of rotors) r.rotation.y += dt * 40;
  }) as Anim;
  return g;
}

function crate(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(3.4, 3.4, 3.4), new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.9 })));
  g.userData.anim = ((o, _t, dt) => {
    o.rotation.x += dt * 1.3;
    o.rotation.z += dt * 0.9;
  }) as Anim;
  return g;
}

function debris(): THREE.Object3D {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.9 });
  g.add(mesh(new THREE.BoxGeometry(4, 0.4, 1), m));
  g.add(mesh(new THREE.BoxGeometry(0.4, 2.5, 1), m, 1, 0.5, 0.3));
  g.add(mesh(new THREE.BoxGeometry(1.6, 0.25, 1.4), lam('#c8553d'), -1, 0.4, 0));
  g.userData.anim = ((o, _t, dt) => {
    o.rotation.x += dt * 3;
    o.rotation.y += dt * 2.2;
  }) as Anim;
  return g;
}

function iceShard(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.OctahedronGeometry(2.4, 0).scale(0.8, 1.6, 0.8), new THREE.MeshStandardMaterial({ color: '#bde0fe', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85, flatShading: true, emissive: '#4a90b8', emissiveIntensity: 0.3 })));
  g.add(glow('#bde0fe', 6));
  g.userData.anim = ((o, _t, dt) => {
    o.rotation.y += dt * 1.5;
  }) as Anim;
  return g;
}

function meteor(color = '#ff7b00'): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.DodecahedronGeometry(2.6, 0), new THREE.MeshStandardMaterial({ color: '#4a3020', emissive: color, emissiveIntensity: 0.6, flatShading: true, roughness: 0.9 })));
  g.add(glow(color, 11));
  g.userData.anim = ((o, _t, dt) => {
    o.rotation.x += dt * 2;
    o.rotation.y += dt * 1.4;
  }) as Anim;
  g.userData.trail = color;
  return g;
}

function spaceJunk(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.6, 1.6, 2.2), lam('#adb5bd', { metalness: 0.7, roughness: 0.3 })));
  const panel = new THREE.MeshStandardMaterial({ color: '#1d4ed8', metalness: 0.6, roughness: 0.25, emissive: '#0b2a6f', emissiveIntensity: 0.3 });
  g.add(mesh(new THREE.BoxGeometry(5, 0.06, 1.6), panel, 3.4, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(5, 0.06, 1.6), panel, -3.4, 0, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 4), lam('#ddd'), 0, 1.6, 0));
  g.userData.anim = ((o, _t, dt) => {
    o.rotation.z += dt * 0.6;
    o.rotation.x += dt * 0.3;
  }) as Anim;
  return g;
}

function skyJelly(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#9bf6ff', emissive: '#4cc9f0', emissiveIntensity: 0.6, transparent: true, opacity: 0.6, roughness: 0.2 });
  g.add(mesh(new THREE.SphereGeometry(4.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat));
  const tent = new THREE.MeshBasicMaterial({ color: '#caffbf', transparent: true, opacity: 0.6 });
  const tentacles: THREE.Object3D[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const t = mesh(new THREE.CylinderGeometry(0.12, 0.03, 6, 4).translate(0, -3, 0), tent, Math.cos(a) * 3, 0, Math.sin(a) * 3);
    tentacles.push(t);
    g.add(t);
  }
  g.add(glow('#9bf6ff', 14));
  g.userData.anim = ((o, t) => {
    const p = 1 + Math.sin(t * 2.5 + o.id) * 0.12;
    o.scale.set(p, 2 - p, p);
    tentacles.forEach((tt, i) => (tt.rotation.z = Math.sin(t * 3 + i) * 0.3));
  }) as Anim;
  return g;
}

function anomaly(): THREE.Object3D {
  const g = new THREE.Group();
  const rings: THREE.Object3D[] = [];
  for (let i = 0; i < 3; i++) {
    const r = mesh(new THREE.TorusGeometry(6 + i * 2.5, 0.25, 8, 40), new THREE.MeshBasicMaterial({ color: i % 2 ? '#c77dff' : '#7b2cbf', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    rings.push(r);
    g.add(r);
  }
  g.add(mesh(new THREE.SphereGeometry(3, 16, 12), new THREE.MeshBasicMaterial({ color: '#10002b' })));
  g.add(glow('#c77dff', 30));
  g.userData.anim = ((_o, t) => {
    rings.forEach((r, i) => {
      r.rotation.x = t * (0.6 + i * 0.3);
      r.rotation.y = t * (0.4 - i * 0.2);
    });
  }) as Anim;
  return g;
}

function lavaBomb(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.IcosahedronGeometry(2.2, 0), new THREE.MeshStandardMaterial({ color: '#3a1a10', emissive: '#ff4800', emissiveIntensity: 0.9, flatShading: true })));
  g.add(glow('#ff6a00', 9));
  g.userData.trail = '#ff6a00';
  g.userData.anim = ((o, _t, dt) => {
    o.rotation.x += dt * 4;
  }) as Anim;
  return g;
}

export function makeHazardView(id: ObstacleId): THREE.Object3D {
  switch (id) {
    case 'birds': return bird('#3d405b', '#5c6b8a', 1);
    case 'geese': return bird('#c9c9c9', '#8d8d8d', 1.4, true);
    case 'plane': return plane();
    case 'helicopter': return helicopter();
    case 'glider': return glider();
    case 'weatherBalloon': return weatherBalloon();
    case 'drone': return drone();
    case 'cargo': return crate();
    case 'debris': return debris();
    case 'iceShard': return iceShard();
    case 'meteor': return meteor();
    case 'spaceJunk': return spaceJunk();
    case 'skyJelly': return skyJelly();
    case 'anomaly': return anomaly();
    case 'lavaBomb': return lavaBomb();
  }
}

export function makeCollectibleView(id: CollectibleId): THREE.Object3D {
  const g = new THREE.Group();
  switch (id) {
    case 'coin':
    case 'bigCoin': {
      const big = id === 'bigCoin';
      const gold = new THREE.MeshStandardMaterial({ color: big ? '#ffb703' : '#ffd166', metalness: 0.35, roughness: 0.3, emissive: '#c98a00', emissiveIntensity: 0.55 });
      const r = big ? 1.7 : 1.1;
      g.add(mesh(new THREE.CylinderGeometry(r, r, 0.25, 20).rotateX(Math.PI / 2), gold));
      g.add(mesh(new THREE.TorusGeometry(r * 0.75, 0.08, 6, 20), gold, 0, 0, 0.13));
      if (big) g.add(mesh(new THREE.OctahedronGeometry(0.6, 0).scale(1, 1, 0.3), gold, 0, 0, 0.2));
      g.add(glow('#ffd166', big ? 6 : 4));
      break;
    }
    case 'fuel': {
      g.add(mesh(new THREE.CapsuleGeometry(0.8, 1.4, 4, 10), new THREE.MeshStandardMaterial({ color: '#ef476f', emissive: '#7a1030', emissiveIntensity: 0.5, roughness: 0.4 })));
      g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 8), lam('#ddd'), 0, 1.6, 0));
      g.add(mesh(new THREE.TorusGeometry(0.82, 0.08, 6, 16).rotateX(Math.PI / 2), lam('#ffd166'), 0, 0.2, 0));
      g.add(glow('#ff6b8a', 6));
      break;
    }
    case 'repair': {
      g.add(mesh(new THREE.BoxGeometry(2, 1.5, 1.2), lam('#06d6a0', { emissive: '#037a5a', emissiveIntensity: 0.5 })));
      const w = lam('#ffffff');
      g.add(mesh(new THREE.BoxGeometry(1, 0.3, 0.1), w, 0, 0, 0.62));
      g.add(mesh(new THREE.BoxGeometry(0.3, 1, 0.1), w, 0, 0, 0.62));
      g.add(mesh(new THREE.TorusGeometry(0.4, 0.08, 6, 10, Math.PI), lam('#333'), 0, 0.75, 0));
      g.add(glow('#06d6a0', 6));
      break;
    }
    case 'o2mini': {
      g.add(mesh(new THREE.SphereGeometry(1.05, 14, 10), new THREE.MeshBasicMaterial({ color: '#7fe6ff', transparent: true, opacity: 0.85 })));
      g.add(mesh(new THREE.SphereGeometry(0.28, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' }), -0.35, 0.4, 0.7));
      g.add(glow('#5ad8ff', 7));
      g.add(glow('#ffffff', 2.5));
      break;
    }
    case 'oxygen': {
      g.add(mesh(new THREE.SphereGeometry(1.5, 16, 12), new THREE.MeshStandardMaterial({ color: '#bdeaff', emissive: '#4cc9f0', emissiveIntensity: 0.7, transparent: true, opacity: 0.6, roughness: 0.05 })));
      g.add(mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), -0.5, 0.6, 0.9));
      g.add(glow('#8ecae6', 6));
      break;
    }
    case 'shard': {
      g.add(mesh(new THREE.OctahedronGeometry(1.3, 0).scale(0.7, 1.4, 0.7), new THREE.MeshStandardMaterial({ color: '#c77dff', emissive: '#7b2cbf', emissiveIntensity: 0.8, flatShading: true, metalness: 0.4, roughness: 0.1 })));
      g.add(glow('#c77dff', 8));
      break;
    }
    case 'relic': {
      g.add(mesh(new THREE.IcosahedronGeometry(1.6, 0), new THREE.MeshStandardMaterial({ color: '#00f5d4', emissive: '#00bbaa', emissiveIntensity: 0.9, flatShading: true })));
      g.add(mesh(new THREE.TorusGeometry(2.6, 0.12, 6, 30), new THREE.MeshBasicMaterial({ color: '#fff3b0' })));
      g.add(glow('#00f5d4', 14));
      break;
    }
  }
  g.userData.anim = ((o, t) => {
    o.rotation.y = t * 2.2 + o.id;
    o.position.y += Math.sin(t * 2.5 + o.id) * 0.01;
  }) as Anim;
  return g;
}

/** Keeps a 3D view per live simulation entity, recycling views by type. */
export class ViewPool<K extends string> {
  readonly group = new THREE.Group();
  private live = new Map<number, { key: K; obj: THREE.Object3D }>();
  private free = new Map<K, THREE.Object3D[]>();
  private seen = new Set<number>();
  constructor(private factory: (k: K) => THREE.Object3D) {}

  begin() {
    this.seen.clear();
  }
  get(uid: number, key: K): THREE.Object3D {
    this.seen.add(uid);
    let e = this.live.get(uid);
    if (!e || e.key !== key) {
      if (e) this.release(uid);
      const list = this.free.get(key);
      const obj = list?.pop() ?? this.factory(key);
      obj.visible = true;
      this.group.add(obj);
      e = { key, obj };
      this.live.set(uid, e);
    }
    return e.obj;
  }
  /** Releases views whose entity wasn't touched this frame; returns positions of released ones. */
  end(onRelease?: (obj: THREE.Object3D) => void) {
    for (const uid of [...this.live.keys()]) {
      if (!this.seen.has(uid)) {
        const e = this.live.get(uid)!;
        onRelease?.(e.obj);
        this.release(uid);
      }
    }
  }
  private release(uid: number) {
    const e = this.live.get(uid);
    if (!e) return;
    e.obj.visible = false;
    this.group.remove(e.obj);
    let list = this.free.get(e.key);
    if (!list) this.free.set(e.key, (list = []));
    list.push(e.obj);
    this.live.delete(uid);
  }
  clear() {
    this.begin();
    this.end();
  }
}

export const animate = (o: THREE.Object3D, t: number, dt: number) => (o.userData.anim as Anim | undefined)?.(o, t, dt);
