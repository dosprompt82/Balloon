import * as THREE from 'three';
import { damp, clamp } from '../core/math';

/** Smooth follow camera with user orbit, zoom, look-ahead and comfortable shake. */
export class CameraRig {
  yaw = 0;
  pitch = -0.06;
  distance = 62;
  private target = new THREE.Vector3();
  private pos = new THREE.Vector3();
  private shake = 0;
  private shakeT = 0;
  shakeScale = 0.6;
  private initialized = false;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  addShake(amount: number) {
    this.shake = Math.min(1.5, this.shake + amount);
  }

  input(dx: number, dy: number, wheel: number) {
    this.yaw = clamp(this.yaw - dx * 0.005, -1.1, 1.1);
    this.pitch = clamp(this.pitch + dy * 0.004, -0.45, 0.6);
    this.distance = clamp(this.distance + wheel * 5, 32, 125);
  }

  reset() {
    this.initialized = false;
  }

  /** Shift internal positions for a floating-origin rebase. */
  shift(dx: number, dy: number) {
    this.target.x -= dx;
    this.target.y -= dy;
    this.pos.x -= dx;
    this.pos.y -= dy;
  }

  update(dt: number, tx: number, ty: number, vx: number, vy: number, turbulence: number, time: number) {
    const want = new THREE.Vector3(tx + vx * 0.8, ty + 8 + clamp(vy * 1.2, -6, 12), 0);
    if (!this.initialized) {
      this.target.copy(want);
      this.initialized = true;
    }
    this.target.x = damp(this.target.x, want.x, 3, dt);
    // follow tighter at high climb rates (Hyperion) so the balloon never leaves frame
    this.target.y = damp(this.target.y, want.y, 3.5 + Math.abs(vy) * 0.25, dt);
    const cp = Math.cos(this.pitch);
    const off = new THREE.Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp).multiplyScalar(this.distance);
    this.pos.copy(this.target).add(off);
    this.camera.position.copy(this.pos);
    // gentle turbulence sway + decaying impact shake
    this.shake = Math.max(0, this.shake - dt * 1.8);
    this.shakeT += dt;
    const sway = Math.min(1, turbulence * 0.5) * 0.35 * this.shakeScale;
    const sh = this.shake * this.shakeScale;
    this.camera.position.x += Math.sin(time * 1.3) * sway + (Math.sin(this.shakeT * 47) * 0.6 + Math.sin(this.shakeT * 31)) * sh * 0.6;
    this.camera.position.y += Math.sin(time * 1.7 + 1) * sway * 0.7 + Math.cos(this.shakeT * 53) * sh * 0.5;
    this.camera.lookAt(this.target);
  }

  /** Slow cinematic orbit for menus. */
  showcase(dt: number, tx: number, ty: number, time: number, dist: number, height: number, screenShift = 0) {
    const a = time * 0.08;
    const want = new THREE.Vector3(tx + Math.sin(a) * dist, ty + height, Math.cos(a) * dist);
    if (!this.initialized) {
      this.pos.copy(want);
      this.initialized = true;
    }
    this.pos.lerp(want, 1 - Math.exp(-dt * 2));
    this.camera.position.copy(this.pos);
    // shift the look target sideways so the subject sits beside UI panels
    this.target.set(tx - Math.cos(a) * screenShift, ty + 9, Math.sin(a) * screenShift);
    this.camera.lookAt(this.target);
  }
}
