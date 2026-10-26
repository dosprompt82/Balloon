import * as THREE from 'three';
import { ZONES, zoneIndexAt } from '../../data/zones';
import { smoothstep } from '../core/math';

export interface EnvPalette {
  zenith: THREE.Color;
  horizon: THREE.Color;
  sun: THREE.Color;
  sunDir: THREE.Vector3;
  cloud: THREE.Color;
  cloudGlow: THREE.Color;
  fog: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  stars: number;
  aurora: number;
  sunIntensity: number;
  cloudDensity: number;
}

const CLOUD_DENSITY = [0.5, 0.95, 0.85, 0.7, 0.55, 0.4, 0.28, 0.16, 0.12, 0.1];
const tmp = new THREE.Color();

/** Sky, light and cloud palette for an altitude, time of day (0..1, 0.5 = noon) and storm gloom. */
export function computePalette(alt: number, tod: number, gloom: number, out?: EnvPalette): EnvPalette {
  const p: EnvPalette = out ?? {
    zenith: new THREE.Color(), horizon: new THREE.Color(), sun: new THREE.Color(), sunDir: new THREE.Vector3(),
    cloud: new THREE.Color(), cloudGlow: new THREE.Color(), fog: new THREE.Color(), hemiSky: new THREE.Color(), hemiGround: new THREE.Color(),
    stars: 0, aurora: 0, sunIntensity: 1, cloudDensity: 1,
  };
  const zi = zoneIndexAt(alt);
  const z = ZONES[zi];
  const n = ZONES[Math.min(ZONES.length - 1, zi + 1)];
  const span = z.max === Infinity ? 1e9 : z.max - z.min;
  const t = smoothstep(0.55, 1, (alt - z.min) / span);
  p.zenith.set(z.zenith).lerp(tmp.set(n.zenith), t);
  p.horizon.set(z.horizon).lerp(tmp.set(n.horizon), t);
  p.cloud.set(z.cloudTint).lerp(tmp.set(n.cloudTint), t);
  p.cloudDensity = CLOUD_DENSITY[zi] + (CLOUD_DENSITY[Math.min(9, zi + 1)] - CLOUD_DENSITY[zi]) * t;

  const elev = Math.sin((tod - 0.25) * Math.PI * 2);
  const az = (tod - 0.5) * Math.PI * 1.6;
  p.sunDir.set(Math.sin(az) * 0.8, Math.max(-0.1, elev), -0.6).normalize();
  const high = smoothstep(14000, 40000, alt);
  const warm = (1 - smoothstep(0.05, 0.45, elev)) * (1 - high * 0.8);
  p.horizon.lerp(tmp.set('#ff9466'), warm * 0.65);
  p.zenith.lerp(tmp.set('#53509a'), warm * 0.35);
  p.cloud.lerp(tmp.set('#ffc2a8'), warm * 0.55);
  p.cloudGlow.set('#ff7a59').multiplyScalar(warm * 0.18);
  p.sun.set('#fff6dd').lerp(tmp.set('#ffa25c'), warm);
  const dusk = smoothstep(0.1, -0.15, elev);
  p.zenith.multiplyScalar(1 - dusk * 0.5);
  p.horizon.multiplyScalar(1 - dusk * 0.35);
  p.sunIntensity = (1 - dusk * 0.6) * (1 - gloom * 0.55);

  // storms
  p.zenith.lerp(tmp.set('#2c3140'), gloom * 0.85);
  p.horizon.lerp(tmp.set('#5d6573'), gloom * 0.8);
  p.cloud.lerp(tmp.set('#4f5566'), gloom * 0.75);
  p.fog.copy(p.horizon);
  p.hemiSky.copy(p.zenith).lerp(tmp.set('#ffffff'), 0.45);
  p.hemiGround.set(alt < 8000 ? '#6c8b55' : '#3f5f8f').lerp(tmp.set('#20123a'), smoothstep(40000, 90000, alt));
  p.stars = smoothstep(22000, 42000, alt) + dusk * 0.7;
  p.aurora = smoothstep(45000, 90000, alt);
  return p;
}
