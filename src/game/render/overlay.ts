import * as THREE from 'three';

export interface Floater {
  text: string;
  color: string;
  x: number;
  y: number;
  z: number;
  t: number;
  life: number;
  size: number;
}

export interface Indicator {
  x: number;
  y: number;
  color: string;
  label: string;
  urgency: number;
}

/** 2D canvas drawn over the WebGL view: off-screen hazard arrows and floating combat text. */
export class Overlay {
  readonly canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  floaters: Floater[] = [];
  private v = new THREE.Vector3();

  constructor() {
    Object.assign(this.canvas.style, { position: 'absolute', inset: '0', pointerEvents: 'none', width: '100%', height: '100%' });
  }

  resize(w: number, h: number, dpr: number) {
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  add(text: string, color: string, x: number, y: number, size = 18, life = 1.2) {
    this.floaters.push({ text, color, x, y, z: 0, t: 0, life, size });
    if (this.floaters.length > 40) this.floaters.shift();
  }

  shift(dx: number, dy: number) {
    for (const f of this.floaters) {
      f.x -= dx;
      f.y -= dy;
    }
  }

  draw(dt: number, camera: THREE.Camera, w: number, h: number, indicators: Indicator[], time: number) {
    const g = this.ctx;
    g.clearRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const f of this.floaters) {
      f.t += dt;
      this.v.set(f.x, f.y, f.z).project(camera);
      if (this.v.z > 1) continue;
      const sx = (this.v.x * 0.5 + 0.5) * w;
      const sy = (-this.v.y * 0.5 + 0.5) * h - f.t * 40;
      const a = Math.max(0, 1 - f.t / f.life);
      const pop = 1 + Math.max(0, 0.3 - f.t) * 1.5;
      g.globalAlpha = a;
      g.font = `900 ${Math.round(f.size * pop)}px "Baloo 2", "Trebuchet MS", system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(20,20,40,0.75)';
      g.strokeText(f.text, sx, sy);
      g.fillStyle = f.color;
      g.fillText(f.text, sx, sy);
    }
    this.floaters = this.floaters.filter((f) => f.t < f.life);
    g.globalAlpha = 1;

    // off-screen indicators
    const m = 34;
    for (const ind of indicators) {
      this.v.set(ind.x, ind.y, 0).project(camera);
      let sx = (this.v.x * 0.5 + 0.5) * w;
      let sy = (-this.v.y * 0.5 + 0.5) * h;
      const behind = this.v.z > 1;
      if (behind) {
        sx = w - sx;
        sy = h - sy;
      }
      const inside = !behind && sx > m && sx < w - m && sy > m + 60 && sy < h - m;
      if (inside) continue;
      const cx = w / 2;
      const cy = h / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      const ex = Math.cos(ang);
      const ey = Math.sin(ang);
      const scale = Math.min((w / 2 - m) / Math.abs(ex || 1e-6), (h / 2 - m - 30) / Math.abs(ey || 1e-6));
      const px = cx + ex * scale;
      const py = cy + ey * scale + 15;
      const pulse = 1 + Math.sin(time * (6 + ind.urgency * 10)) * 0.15 * (0.4 + ind.urgency);
      g.save();
      g.translate(px, py);
      g.rotate(ang);
      g.scale(pulse, pulse);
      g.globalAlpha = 0.55 + 0.45 * ind.urgency;
      g.fillStyle = ind.color;
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(16, 0);
      g.lineTo(-8, -11);
      g.lineTo(-3, 0);
      g.lineTo(-8, 11);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
      if (ind.label) {
        g.globalAlpha = 0.9;
        g.font = '700 12px system-ui, sans-serif';
        g.fillStyle = '#fff';
        g.fillText(ind.label, px - ex * 26, py - ey * 26);
      }
      g.globalAlpha = 1;
    }
  }

  clear() {
    this.floaters = [];
  }
}
