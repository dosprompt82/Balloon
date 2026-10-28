import * as THREE from 'three';
import { hashInts, noise1 } from '../core/rng';

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function once(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

/** Woven wicker basket texture. */
export const wickerTexture = () =>
  once('wicker', () => {
    const [c, g] = canvas(128, 128);
    g.fillStyle = '#7a4a22';
    g.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const x = col * 16;
        const y = row * 16;
        const horiz = (row + col) % 2 === 0;
        const grd = horiz ? g.createLinearGradient(x, y, x, y + 16) : g.createLinearGradient(x, y, x + 16, y);
        grd.addColorStop(0, '#8d5a2b');
        grd.addColorStop(0.5, '#d4a15e');
        grd.addColorStop(1, '#7b4a20');
        g.fillStyle = grd;
        g.beginPath();
        g.roundRect(x + 1, y + 1, 14, 14, 5);
        g.fill();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });

/** Soft round glow used by sprites and particles. */
export const glowTexture = () =>
  once('glow', () => {
    const [c, g] = canvas(64, 64);
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.3, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  });

/** Stylised planet surface for the high-altitude view. */
export const planetTexture = () =>
  once('planet', () => {
    const W = 1024;
    const H = 512;
    const [c, g] = canvas(W, H);
    const img = g.createImageData(W, H);
    const fbm = (x: number, y: number, s: number) => {
      let v = 0;
      let a = 0.5;
      let f = 1;
      for (let o = 0; o < 5; o++) {
        v += a * (noise1(x * f + noise1(y * f * 0.7, s + o) * 3, s + o * 13) + noise1(y * f, s + o * 7)) * 0.5;
        a *= 0.5;
        f *= 2.1;
      }
      return v;
    };
    for (let y = 0; y < H; y++) {
      const lat = Math.abs(y / H - 0.5) * 2;
      for (let x = 0; x < W; x++) {
        const u = (x / W) * 12;
        const v = (y / H) * 6;
        const land = fbm(u, v, 11);
        const cloud = fbm(u * 1.7 + 50, v * 2.2, 29);
        let r: number;
        let gg: number;
        let b: number;
        if (land > 0.08) {
          const t = Math.min(1, (land - 0.08) * 4);
          r = 70 + 90 * t;
          gg = 140 + 20 * t;
          b = 70 + 10 * t;
          if (lat > 0.75) [r, gg, b] = [235, 245, 255];
        } else {
          const d = Math.max(0, -land);
          r = 30 - d * 30;
          gg = 110 - d * 60;
          b = 190 - d * 40;
          if (lat > 0.85) [r, gg, b] = [220, 235, 250];
        }
        if (cloud > 0.12) {
          const ca = Math.min(0.85, (cloud - 0.12) * 4);
          r += (255 - r) * ca;
          gg += (255 - gg) * ca;
          b += (255 - b) * ca;
        }
        const i = (y * W + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = gg;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  });

/** Wood plank texture for crates and debris. */
export const plankTexture = () =>
  once('plank', () => {
    const [c, g] = canvas(64, 64);
    for (let i = 0; i < 4; i++) {
      const shade = 130 + (hashInts(i, 5) % 50);
      g.fillStyle = `rgb(${shade},${shade * 0.66},${shade * 0.38})`;
      g.fillRect(0, i * 16, 64, 15);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, i * 16 + 15, 64, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
