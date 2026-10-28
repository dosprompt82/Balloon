import * as THREE from 'three';
import type { CharacterDef } from '../../data/characters';
import { glowTexture } from './textures';

export type Pose = 'idle' | 'burn' | 'panic' | 'celebrate' | 'repair' | 'wave' | 'sad';

export interface Look {
  shirt: string;
  pants: string;
  accessory: string;
}

const std = (color: string, rough = 0.7) => new THREE.MeshStandardMaterial({ color, roughness: rough });

/** Stylised, chunky crew member built from rounded primitives, with a small pose system. */
export class CharacterRig {
  readonly group = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private eyes: THREE.Mesh[] = [];
  private pupils: THREE.Mesh[] = [];
  private brows: THREE.Mesh[] = [];
  private smile: THREE.Mesh;
  private oMouth: THREE.Mesh;
  private propeller?: THREE.Object3D;
  private blinkT = 2;
  pose: Pose = 'idle';
  private poseBlend = 0;
  lookX = 0;

  constructor(def: CharacterDef, look: Look) {
    const skin = std(def.skin, 0.6);
    const shirt = std(look.shirt);
    const pants = std(look.pants);
    const hair = std(def.hair, 0.85);
    const accent = std(def.accent);
    const hScale = def.build === 'tall' ? 1.12 : def.build === 'short' ? 0.9 : 1;
    const wScale = def.build === 'broad' ? 1.2 : def.build === 'short' ? 1.05 : 1;

    this.group.add(this.body);
    // legs & shoes
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.6, 4, 8), pants);
      leg.position.set(sx * 0.2, 0.55, 0);
      this.body.add(leg);
      const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6).scale(1, 0.6, 1.4), std('#2b2d42'));
      shoe.position.set(sx * 0.2, 0.15, 0.08);
      this.body.add(shoe);
    }
    // torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.4 * wScale, 0.55 * hScale, 6, 12), shirt);
    torso.position.y = 1.45 * hScale;
    this.body.add(torso);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.4 * wScale, 0.06, 6, 16).rotateX(Math.PI / 2), accent);
    belt.position.y = 1.12 * hScale;
    this.body.add(belt);
    // arms (pivot at shoulder)
    for (const [arm, sx] of [[this.armL, -1], [this.armR, 1]] as const) {
      arm.position.set(sx * 0.5 * wScale, 1.8 * hScale, 0);
      const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.32, 4, 8), shirt);
      sleeve.position.y = -0.22;
      arm.add(sleeve);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.3, 4, 8), skin);
      fore.position.y = -0.55;
      arm.add(fore);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), skin);
      hand.position.y = -0.78;
      arm.add(hand);
      this.body.add(arm);
    }
    // head
    this.head.position.y = 2.45 * hScale;
    this.body.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.56, 16, 12), skin);
    this.head.add(skull);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), skin);
      ear.position.set(sx * 0.55, -0.02, 0);
      this.head.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), std('#ffffff', 0.3));
      eye.position.set(sx * 0.2, 0.06, 0.47);
      eye.scale.z = 0.6;
      this.head.add(eye);
      this.eyes.push(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), std('#1b1b1e', 0.2));
      pupil.position.set(sx * 0.2, 0.06, 0.55);
      this.head.add(pupil);
      this.pupils.push(pupil);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.04), hair);
      brow.position.set(sx * 0.2, 0.24, 0.5);
      this.head.add(brow);
      this.brows.push(brow);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshStandardMaterial({ color: '#ff8fa3', transparent: true, opacity: 0.6 }));
      cheek.position.set(sx * 0.32, -0.12, 0.44);
      cheek.scale.z = 0.4;
      this.head.add(cheek);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), skin);
    nose.position.set(0, -0.04, 0.56);
    this.head.add(nose);
    this.smile = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 12, Math.PI), std('#6b2737'));
    this.smile.rotation.z = Math.PI;
    this.smile.position.set(0, -0.17, 0.5);
    this.head.add(this.smile);
    this.oMouth = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6).scale(1, 1.3, 0.5), std('#4a1c27'));
    this.oMouth.position.set(0, -0.2, 0.51);
    this.oMouth.visible = false;
    this.head.add(this.oMouth);

    this.buildHair(def, hair);
    this.buildAccessory(look.accessory, def);
  }

  private buildHair(def: CharacterDef, mat: THREE.Material) {
    const h = this.head;
    const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, m = mat) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      h.add(mesh);
      return mesh;
    };
    const cap = (scale = 1.06, cut = 0.55) => add(new THREE.SphereGeometry(0.56 * scale, 16, 10, 0, Math.PI * 2, 0, Math.PI * cut), 0, 0.02, -0.02);
    switch (def.hairStyle) {
      case 'messy':
        cap();
        for (let i = 0; i < 7; i++) add(new THREE.SphereGeometry(0.2, 6, 5), Math.cos(i) * 0.3, 0.45 + (i % 2) * 0.08, Math.sin(i * 2) * 0.25);
        add(new THREE.ConeGeometry(0.12, 0.35, 5).rotateZ(-0.6), 0.25, 0.42, 0.35);
        break;
      case 'ponytail':
        cap();
        add(new THREE.SphereGeometry(0.2, 8, 6).scale(0.8, 1.8, 0.8), 0, 0.05, -0.65).rotation.x = 0.5;
        add(new THREE.TorusGeometry(0.1, 0.04, 6, 10), 0, 0.3, -0.55, std('#ff6b6b'));
        break;
      case 'buzz':
        cap(1.02, 0.45);
        break;
      case 'bob': {
        cap(1.1, 0.62);
        add(new THREE.SphereGeometry(0.62, 14, 10, Math.PI * 0.62, Math.PI * 1.76, Math.PI * 0.3, Math.PI * 0.4), 0, -0.05, 0);
        break;
      }
      case 'mohawk':
        cap(1.01, 0.4);
        for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.1, 0.45, 5), 0, 0.58 - Math.abs(i - 2) * 0.05, 0.35 - i * 0.18).rotation.x = -0.3 + i * 0.15;
        break;
      case 'curls':
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          add(new THREE.SphereGeometry(0.19, 6, 5), Math.cos(a) * 0.48, 0.32 + Math.sin(i * 1.7) * 0.06, Math.sin(a) * 0.45 - 0.05);
        }
        add(new THREE.SphereGeometry(0.4, 8, 6), 0, 0.42, -0.05);
        break;
      case 'bun':
        cap();
        add(new THREE.SphereGeometry(0.25, 8, 6), 0, 0.62, -0.18);
        break;
      case 'captain':
        cap(1.04, 0.35);
        add(new THREE.SphereGeometry(0.34, 10, 8).scale(1.2, 0.9, 0.7), 0, -0.4, 0.32);
        add(new THREE.CapsuleGeometry(0.06, 0.22, 4, 6).rotateZ(Math.PI / 2), 0, -0.1, 0.56);
        break;
    }
  }

  private buildAccessory(id: string, def: CharacterDef) {
    const h = this.head;
    const accent = std(def.accent);
    const dark = std('#222831', 0.3);
    const add = (o: THREE.Object3D, parent: THREE.Object3D = h) => {
      parent.add(o);
      return o;
    };
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      return o;
    };
    switch (id) {
      case 'scarf':
        add(mesh(new THREE.TorusGeometry(0.34, 0.12, 6, 14).rotateX(Math.PI / 2), accent, 0, 2.05, 0), this.body);
        add(mesh(new THREE.BoxGeometry(0.18, 0.5, 0.06), accent, 0.18, 1.8, 0.35), this.body).rotation.z = 0.3;
        break;
      case 'headphones':
        add(mesh(new THREE.TorusGeometry(0.6, 0.05, 6, 16, Math.PI), dark, 0, 0.05, 0));
        for (const sx of [-1, 1]) add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 12).rotateZ(Math.PI / 2), accent, sx * 0.6, 0, 0));
        break;
      case 'goggles':
        add(mesh(new THREE.TorusGeometry(0.57, 0.04, 6, 20).rotateX(Math.PI / 2), dark, 0, 0.32, 0));
        for (const sx of [-1, 1]) add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 12).rotateX(Math.PI / 2), std('#7fd6ff', 0.1), sx * 0.2, 0.34, 0.5));
        break;
      case 'beanie':
        add(mesh(new THREE.SphereGeometry(0.6, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), accent, 0, 0.08, 0));
        add(mesh(new THREE.TorusGeometry(0.56, 0.08, 6, 18).rotateX(Math.PI / 2), accent, 0, 0.12, 0));
        add(mesh(new THREE.SphereGeometry(0.14, 8, 6), std('#ffffff'), 0, 0.7, 0));
        break;
      case 'shades':
        for (const sx of [-1, 1]) add(mesh(new THREE.BoxGeometry(0.26, 0.15, 0.05), dark, sx * 0.2, 0.07, 0.55));
        add(mesh(new THREE.BoxGeometry(0.15, 0.03, 0.03), dark, 0, 0.1, 0.56));
        break;
      case 'aviator':
        add(mesh(new THREE.SphereGeometry(0.6, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), std('#7f5539'), 0, 0.05, -0.02));
        for (const sx of [-1, 1]) add(mesh(new THREE.BoxGeometry(0.12, 0.35, 0.25), std('#7f5539'), sx * 0.56, -0.12, 0));
        add(mesh(new THREE.TorusGeometry(0.57, 0.035, 6, 20).rotateX(Math.PI / 2 - 0.2), dark, 0, 0.3, 0.05));
        break;
      case 'glasses':
        for (const sx of [-1, 1]) add(mesh(new THREE.TorusGeometry(0.14, 0.025, 6, 14), dark, sx * 0.2, 0.06, 0.56));
        break;
      case 'captainHat': {
        add(mesh(new THREE.CylinderGeometry(0.55, 0.58, 0.32, 18), std('#f1faee'), 0, 0.55, -0.02));
        add(mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 18), std('#1d3557'), 0, 0.4, 0));
        const visor = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 14, 1, false, -Math.PI / 2, Math.PI), dark, 0, 0.38, 0.25);
        add(visor);
        add(mesh(new THREE.SphereGeometry(0.08, 6, 4), std('#e9c46a', 0.2), 0, 0.55, 0.55));
        break;
      }
      case 'topHat':
        add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.75, 16), dark, 0, 0.85, 0));
        add(mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 18), dark, 0, 0.48, 0));
        add(mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.12, 16), accent, 0, 0.58, 0));
        break;
      case 'flowerCrown': {
        const colors = ['#ff70a6', '#ffd670', '#70d6ff', '#ff9770', '#e9ff70'];
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          add(mesh(new THREE.SphereGeometry(0.1, 6, 5), std(colors[i % colors.length]), Math.cos(a) * 0.52, 0.35, Math.sin(a) * 0.52));
        }
        break;
      }
      case 'propeller': {
        add(mesh(new THREE.SphereGeometry(0.6, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), std('#ffbe0b'), 0, 0.06, 0));
        const prop = new THREE.Group();
        prop.position.y = 0.72;
        prop.add(mesh(new THREE.BoxGeometry(0.9, 0.03, 0.12), std('#ff006e')));
        prop.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.15, 6), dark, 0, -0.07, 0));
        add(prop);
        this.propeller = prop;
        break;
      }
      case 'crown': {
        const gold = new THREE.MeshStandardMaterial({ color: '#ffd166', metalness: 0.9, roughness: 0.25 });
        add(mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.22, 10, 1, true), gold, 0, 0.58, 0));
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          add(mesh(new THREE.ConeGeometry(0.08, 0.22, 5), gold, Math.cos(a) * 0.42, 0.78, Math.sin(a) * 0.42));
        }
        break;
      }
      case 'halo': {
        add(mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff3b0' }), 0, 0.95, 0));
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#fff3b0', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
        glow.position.y = 0.95;
        glow.scale.setScalar(1.8);
        add(glow);
        break;
      }
    }
  }

  setPose(p: Pose) {
    if (p !== this.pose) {
      this.pose = p;
      this.poseBlend = 0;
    }
  }

  update(dt: number, t: number) {
    this.poseBlend = Math.min(1, this.poseBlend + dt * 6);
    const lerp = (o: THREE.Object3D, rx: number, rz: number, ry = 0) => {
      const a = Math.min(1, dt * 12);
      o.rotation.x += (rx - o.rotation.x) * a;
      o.rotation.z += (rz - o.rotation.z) * a;
      o.rotation.y += (ry - o.rotation.y) * a;
    };
    let bodyY = Math.sin(t * 2) * 0.03;
    let headTilt = Math.sin(t * 0.7) * 0.08;
    let headTurn = this.lookX * 0.5 + Math.sin(t * 0.37) * 0.25;
    let mouthO = false;
    let eyeScale = 1;
    let browTilt = 0;
    switch (this.pose) {
      case 'idle':
        lerp(this.armL, 0.1, 0.15 + Math.sin(t * 1.3) * 0.05);
        lerp(this.armR, 0.1, -0.15 - Math.sin(t * 1.1) * 0.05);
        break;
      case 'burn':
        // right arm up on the burner valve, left on the rope
        lerp(this.armR, -0.3, -2.7 + Math.sin(t * 12) * 0.05);
        lerp(this.armL, 0.2, 0.5);
        headTilt = -0.25;
        browTilt = 0.15;
        break;
      case 'panic':
        lerp(this.armL, Math.sin(t * 14) * 0.4, 2.4 + Math.sin(t * 16) * 0.5);
        lerp(this.armR, Math.cos(t * 14) * 0.4, -2.4 - Math.sin(t * 15) * 0.5);
        bodyY += Math.abs(Math.sin(t * 9)) * 0.06;
        headTurn = Math.sin(t * 6) * 0.6;
        mouthO = true;
        eyeScale = 1.35;
        browTilt = -0.35;
        break;
      case 'celebrate':
        lerp(this.armL, 0, 2.7 + Math.sin(t * 10) * 0.2);
        lerp(this.armR, 0, -2.7 - Math.sin(t * 10) * 0.2);
        bodyY += Math.abs(Math.sin(t * 7)) * 0.25;
        headTilt = Math.sin(t * 7) * 0.15;
        headTurn = 0;
        browTilt = 0.25;
        break;
      case 'repair':
        lerp(this.armR, -1.2 + Math.abs(Math.sin(t * 12)) * 0.9, -0.6);
        lerp(this.armL, -0.9, 0.4);
        headTilt = -0.3;
        headTurn = 0.4;
        break;
      case 'wave':
        lerp(this.armR, 0, -2.5 + Math.sin(t * 8) * 0.35);
        lerp(this.armL, 0.1, 0.15);
        headTurn = 0;
        browTilt = 0.2;
        break;
      case 'sad':
        lerp(this.armL, 0.2, 0.05);
        lerp(this.armR, 0.2, -0.05);
        headTilt = 0.35;
        browTilt = 0.3;
        break;
    }
    this.body.position.y = bodyY;
    lerp(this.head, headTilt, 0, headTurn);
    this.smile.visible = !mouthO;
    this.oMouth.visible = mouthO;
    this.smile.scale.y = this.pose === 'sad' ? -1 : 1;
    this.blinkT -= dt;
    let blink = 1;
    if (this.blinkT < 0) {
      blink = 0.1;
      if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3;
    }
    for (const e of this.eyes) e.scale.set(eyeScale, eyeScale * blink, 0.6);
    for (const [i, p] of this.pupils.entries()) {
      p.visible = blink > 0.5;
      p.position.x = (i === 0 ? -0.2 : 0.2) + this.lookX * 0.04;
    }
    for (const [i, b] of this.brows.entries()) b.rotation.z = (i === 0 ? -1 : 1) * browTilt;
    if (this.propeller) this.propeller.rotation.y += dt * 25;
  }
}
