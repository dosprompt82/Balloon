import { ALTITUDE, RESOURCES } from '../../data/config';
import { ZONES, zoneIndexAt } from '../../data/zones';
import { noise1 } from '../core/rng';
import { lerp, smoothstep } from '../core/math';

const S = ALTITUDE.stretch;

/** Displayed altitude (m) for a playfield height (u). Exponential stretch keeps later zones reachable. */
export const altitudeFromY = (y: number) => S * (Math.exp(Math.max(0, y) / S) - 1);
export const yFromAltitude = (a: number) => S * Math.log(1 + Math.max(0, a) / S);
/** Metres of displayed altitude per playfield unit at altitude a. */
export const altitudeScale = (a: number) => 1 + Math.max(0, a) / S;

const TEMP_TABLE: [number, number][] = [
  [0, 15], [11000, -56], [22000, -56], [35000, -62], [60000, -78], [100000, -96], [200000, -120],
];

export function ambientTemperature(a: number): number {
  if (a <= 0) return TEMP_TABLE[0][1];
  for (let i = 1; i < TEMP_TABLE.length; i++) {
    const [a1, t1] = TEMP_TABLE[i];
    const [a0, t0] = TEMP_TABLE[i - 1];
    if (a <= a1) return lerp(t0, t1, (a - a0) / (a1 - a0));
  }
  return TEMP_TABLE[TEMP_TABLE.length - 1][1];
}

/** Fraction of normal lift available (thin air). resist in [0,1). */
export function liftFactor(a: number, resist: number): number {
  const loss = smoothstep(15000, 60000, a) * 0.42 + smoothstep(60000, 160000, a) * 0.1;
  return 1 - loss * (1 - resist);
}

export const needsOxygen = (a: number) => a >= RESOURCES.oxygenStartAltitude;

/** Stable wind layers: wind varies by playfield height band, plus slow gusts over time. */
export function windAt(y: number, a: number, t: number, seed: number): number {
  const zone = ZONES[zoneIndexAt(a)];
  const layer = noise1(y / 58, seed) * 1.25;
  // sharpen layers so they read as distinct currents
  const shaped = Math.sign(layer) * Math.min(1, Math.abs(layer) ** 0.7);
  const gust = noise1(t * 0.23, seed + 17) * 0.3;
  const lowCalm = smoothstep(0, 40, y) * 0.75 + 0.25;
  return zone.windStrength * (shaped + gust) * lowCalm;
}

export function turbulenceAt(a: number, t: number, seed: number): { x: number; y: number; level: number } {
  const zone = ZONES[zoneIndexAt(a)];
  const level = zone.turbulence;
  return {
    x: noise1(t * 1.7, seed + 3) * level * 3,
    y: noise1(t * 1.3, seed + 5) * level * 3,
    level,
  };
}
