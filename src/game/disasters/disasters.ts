import { disasterById, type DisasterDef, type DisasterId } from '../../data/disasters';
import type { ObstacleId } from '../../data/obstacles';
import { Rng } from '../core/rng';
import { clamp, smoothstep } from '../core/math';
import { PHYSICS } from '../../data/config';

export type DisasterPhase = 'warning' | 'active' | 'ending' | 'done';

export interface Strike { id: number; x: number; y: number; r: number; fuse: number; maxFuse: number; struck: number; }
export interface Shaft { x: number; w: number; vx: number; warm: number; }
export interface Arc { id: number; y: number; x0: number; x1: number; gapX: number; gapW: number; fuse: number; maxFuse: number; life: number; }

export interface DisasterInstance {
  uid: number;
  id: DisasterId;
  def: DisasterDef;
  intensity: number;
  k: number;
  phase: DisasterPhase;
  phaseTime: number;
  warnTime: number;
  duration: number;
  elapsed: number;
  x: number;
  y: number;
  vx: number;
  dir: number;
  radius: number;
  width: number;
  bandTop: number;
  bandBottom: number;
  corridorBase: number;
  corridorSpacing: number;
  corridorHalf: number;
  strikes: Strike[];
  shafts: Shaft[];
  arcs: Arc[];
  timer: number;
  rng: Rng;
  seed: number;
  /** 0..1 visual presence (fades in during warning, out while ending). */
  presence: number;
  hitPlayer: boolean;
}

export interface DisasterEffect {
  windX: number;
  ax: number;
  ay: number;
  envDmg: number;
  basketDmg: number;
  equipDmg: number;
  ice: number;
  visibility: number;
  turbulence: number;
  burnerEff: number;
  gloom: number;
  fog: number;
  tempDelta: number;
  heatJitter: number;
}

export const emptyEffect = (): DisasterEffect => ({
  windX: 0, ax: 0, ay: 0, envDmg: 0, basketDmg: 0, equipDmg: 0, ice: 0, visibility: 1,
  turbulence: 0, burnerEff: 1, gloom: 0, fog: 1, tempDelta: 0, heatJitter: 0,
});

export interface PlayerView {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rodActive: boolean;
  shieldActive: boolean;
  tornadoImmune: boolean;
  warningMult: number;
}

export interface DisasterHooks {
  spawnHazard(id: ObstacleId, x: number, y: number, vx: number, vy: number, telegraph: number): void;
  strike(s: Strike, hit: boolean, absorbed: boolean, d: DisasterInstance): void;
  arcHit(d: DisasterInstance): void;
}

let uidCounter = 1;
const ENV_Y = PHYSICS.envelopeOffsetY;

export function createDisaster(id: DisasterId, intensity: number, p: PlayerView, seed: number, warnTime: number): DisasterInstance {
  const def = disasterById(id);
  const rng = new Rng(seed);
  const k = 1 + 0.35 * intensity;
  const d: DisasterInstance = {
    uid: uidCounter++, id, def, intensity, k, phase: 'warning', phaseTime: 0, warnTime,
    duration: rng.range(def.duration[0], def.duration[1]) * (1 + intensity * 0.06), elapsed: 0,
    x: p.x, y: p.y, vx: 0, dir: rng.sign(), radius: 0, width: 0, bandTop: 0, bandBottom: 0,
    corridorBase: 0, corridorSpacing: 0, corridorHalf: 0,
    strikes: [], shafts: [], arcs: [], timer: 1, rng, seed, presence: 0, hitPlayer: false,
  };
  const side = d.dir;
  switch (id) {
    case 'tornado':
      d.x = p.x + side * (75 + 10 * intensity);
      d.radius = 55 + 8 * intensity;
      d.width = 7 + 1.5 * intensity;
      break;
    case 'volcano':
      d.x = p.x + side * rng.range(38, 60);
      d.width = 8;
      break;
    case 'microburst':
      d.x = p.x + p.vx * warnTime * 0.6 + rng.range(-10, 10);
      d.width = 22 + 4 * intensity;
      break;
    case 'hurricane':
      d.corridorSpacing = 60;
      d.corridorHalf = Math.max(6, 11 - intensity);
      d.corridorBase = p.y + rng.range(15, 40);
      break;
    case 'hailstorm':
      for (let i = 0; i < 2 + intensity; i++) d.shafts.push(newShaft(d, p, true));
      break;
    case 'iceStorm':
      d.bandBottom = p.y - 50;
      d.bandTop = p.y + 95 + 20 * intensity;
      break;
    case 'dustStorm':
      d.bandBottom = -1e9;
      d.bandTop = p.y - 25;
      d.vx = 2.4 + 0.6 * intensity;
      break;
  }
  return d;
}

function newShaft(d: DisasterInstance, p: PlayerView, initial: boolean): Shaft {
  const w = 9 + 2 * d.intensity;
  let x = p.x + d.rng.range(-65, 65);
  // never open a fresh shaft right on top of the player
  if (Math.abs(x - p.x) < w + 8) x = p.x + Math.sign(x - p.x || 1) * (w + 8 + d.rng.range(0, 20));
  return { x, w, vx: d.rng.range(-3, 3), warm: initial ? -d.rng.range(0, 1) : 0 };
}

/** Advance a disaster; returns true when finished. */
export function updateDisaster(d: DisasterInstance, p: PlayerView, dt: number, hooks: DisasterHooks): boolean {
  d.phaseTime += dt;
  if (d.phase === 'warning') {
    d.presence = smoothstep(0, d.warnTime, d.phaseTime) * 0.6;
    if (d.phaseTime >= d.warnTime) {
      d.phase = 'active';
      d.phaseTime = 0;
    }
  } else if (d.phase === 'active') {
    d.elapsed += dt;
    d.presence = Math.min(1, d.presence + dt);
    if (d.elapsed >= d.duration) {
      d.phase = 'ending';
      d.phaseTime = 0;
    }
  } else if (d.phase === 'ending') {
    d.presence = Math.max(0, 1 - d.phaseTime / 3);
    if (d.phaseTime >= 3) d.phase = 'done';
  }
  const active = d.phase === 'active';
  const rng = d.rng;

  switch (d.id) {
    case 'thunderstorm':
    case 'supercell': {
      const sup = d.id === 'supercell';
      if (active) {
        d.timer -= dt;
        if (d.timer <= 0) {
          d.timer = (sup ? 1.35 : 2.5) / d.k * rng.range(0.7, 1.3);
          const n = sup && rng.chance(0.4) ? 2 : 1;
          for (let i = 0; i < n; i++) {
            const fuse = (sup ? 1.35 : 1.6) * (1 + (p.warningMult - 1) * 0.35);
            let sx: number;
            let sy: number;
            if (rng.chance(0.35)) {
              // aim at where the balloon will be — readable, but demands a reaction
              sx = p.x + p.vx * fuse + rng.range(-4, 4);
              sy = p.y + ENV_Y + p.vy * fuse + rng.range(-3, 3);
            } else {
              sx = p.x + rng.range(-34, 34);
              sy = p.y + ENV_Y + rng.range(-8, 34);
            }
            d.strikes.push({ id: uidCounter++, x: sx, y: sy, r: sup ? 8 : 7, fuse, maxFuse: fuse, struck: 0 });
          }
        }
      }
      for (const s of d.strikes) {
        if (s.fuse > 0) {
          s.fuse -= dt;
          if (s.fuse <= 0) {
            s.struck = 0.35;
            const ex = p.x - s.x;
            const ey = p.y + ENV_Y - s.y;
            const by = p.y - s.y;
            const hit = ex * ex + ey * ey < (s.r + PHYSICS.envelopeRadius * 0.7) ** 2 || ex * ex + by * by < (s.r + 2) ** 2;
            if (hit) d.hitPlayer = true;
            hooks.strike(s, hit, hit && p.rodActive, d);
          }
        } else s.struck -= dt;
      }
      d.strikes = d.strikes.filter((s) => s.fuse > 0 || s.struck > 0);
      break;
    }
    case 'tornado': {
      const dx = p.x - d.x;
      const chase = Math.abs(dx) > 18 ? Math.sign(dx) * (1.1 + 0.45 * d.intensity) : 0;
      d.vx = chase + Math.sin(d.phaseTime * 0.35 + d.seed) * 1.8;
      if (d.phase !== 'warning') d.x += d.vx * dt;
      if (d.phase === 'ending') d.radius = Math.max(0, d.radius - dt * 20);
      if (active) {
        d.timer -= dt;
        if (d.timer <= 0) {
          d.timer = 1.7 / d.k;
          const s = rng.sign();
          hooks.spawnHazard('debris', d.x + s * d.width, p.y + rng.range(-5, 45), s * rng.range(10, 16), rng.range(-3, 4), 0);
        }
      }
      break;
    }
    case 'volcano': {
      if (active) {
        d.width = Math.min(16 + 4 * d.intensity, d.width + dt * 2);
        d.x += Math.sin(d.elapsed * 0.4 + d.seed) * 1.2 * dt;
        d.timer -= dt;
        if (d.timer <= 0 && d.intensity >= 1) {
          d.timer = 2.4 / d.k;
          hooks.spawnHazard('lavaBomb', d.x + rng.range(-d.width, d.width), p.y - 55, rng.range(-7, 7), rng.range(26, 34), 0.9);
        }
      }
      break;
    }
    case 'hailstorm': {
      for (const s of d.shafts) {
        s.x += s.vx * dt;
        s.warm += dt;
      }
      if (active) {
        d.timer -= dt;
        if (d.timer <= 0) {
          d.timer = 5.5 / d.k;
          const idx = rng.int(0, d.shafts.length - 1);
          d.shafts[idx] = newShaft(d, p, false);
        }
      }
      break;
    }
    case 'microburst':
      break;
    case 'iceStorm':
      break;
    case 'dustStorm':
      if (d.phase !== 'warning') d.bandTop += d.vx * dt;
      break;
    case 'hurricane':
      break;
    case 'windShear':
      break;
    case 'meteorShower': {
      if (active) {
        d.timer -= dt;
        if (d.timer <= 0) {
          d.timer = 1.15 / d.k * rng.range(0.6, 1.4);
          const tx = p.x + (rng.chance(0.25) ? p.vx * 1.6 : rng.range(-28, 28));
          const ty = p.y + ENV_Y + rng.range(-6, 24);
          const side = rng.sign();
          const speed = rng.range(22, 30);
          const ang = rng.range(0.55, 1.05);
          const vx = -side * Math.cos(ang) * speed;
          const vy = -Math.sin(ang) * speed;
          const travel = 1.9;
          hooks.spawnHazard('meteor', tx - vx * travel, ty - vy * travel, vx, vy, 1.4 * (1 + (p.warningMult - 1) * 0.3));
        }
      }
      break;
    }
    case 'energyStorm': {
      if (active) {
        d.timer -= dt;
        if (d.timer <= 0) {
          d.timer = 2.3 / d.k;
          const gapW = Math.max(11, 20 - 2 * d.intensity);
          const fuse = 1.9 * (1 + (p.warningMult - 1) * 0.3);
          d.arcs.push({
            id: uidCounter++, y: p.y + ENV_Y + rng.range(18, 55), x0: p.x - 90, x1: p.x + 90,
            gapX: p.x + rng.range(-30, 30), gapW, fuse, maxFuse: fuse, life: 2.6,
          });
        }
      }
      for (const a of d.arcs) {
        if (a.fuse > 0) a.fuse -= dt;
        else {
          a.life -= dt;
          const inGap = Math.abs(p.x - a.gapX) < a.gapW / 2;
          const crossing = Math.abs(p.y + ENV_Y - a.y) < PHYSICS.envelopeRadius * 0.8 || Math.abs(p.y + 1 - a.y) < 2;
          if (crossing && !inGap && p.x > a.x0 && p.x < a.x1) {
            a.life = Math.min(a.life, 0.25);
            a.gapW = 999; // discharged
            d.hitPlayer = true;
            hooks.arcHit(d);
          }
        }
      }
      d.arcs = d.arcs.filter((a) => a.fuse > 0 || a.life > 0);
      break;
    }
  }
  return d.phase === 'done';
}

/** Continuous field effects of a disaster on a balloon at (x,y). */
export function disasterEffect(d: DisasterInstance, p: PlayerView, out: DisasterEffect): void {
  const pres = d.presence;
  const on = d.phase === 'active' ? 1 : d.phase === 'ending' ? pres : 0;
  out.gloom = Math.max(out.gloom, d.def.gloom * pres);
  out.fog *= 1 + (d.def.fog - 1) * pres;
  const k = d.k;
  const t = d.elapsed;
  switch (d.id) {
    case 'thunderstorm':
      out.windX += Math.sin(t * 0.7 + d.seed) * 4 * k * on;
      out.turbulence += 0.45 * k * on;
      out.visibility *= 1 - 0.25 * on;
      break;
    case 'supercell':
      out.windX += Math.sin(t * 0.5 + d.seed) * 8 * k * on;
      out.turbulence += 0.8 * k * on;
      out.visibility *= 1 - 0.35 * on;
      out.ay += Math.sin(t * 0.9) * 3 * on;
      break;
    case 'tornado': {
      if (p.tornadoImmune || on <= 0) break;
      const dx = p.x - d.x;
      const dist = Math.abs(dx);
      if (dist < d.radius) {
        const layer = 0.55 + 0.45 * Math.sin((p.y + ENV_Y) / 27 + d.seed);
        const strength = (5 + 2.4 * d.intensity) * Math.pow(1 - dist / d.radius, 0.8) * layer * on;
        out.ax -= Math.sign(dx || 1) * strength;
        out.ay += strength * 0.25;
        out.turbulence += strength * 0.08;
        if (dist < d.width) {
          out.envDmg += 16 * k;
          out.basketDmg += 7 * k;
        }
      }
      break;
    }
    case 'hurricane': {
      const rel = p.y + ENV_Y - d.corridorBase;
      const nearest = Math.round(rel / d.corridorSpacing) * d.corridorSpacing;
      const off = Math.abs(rel - nearest);
      const calm = 1 - smoothstep(d.corridorHalf, d.corridorHalf + 7, off);
      const strength = (13 + 5 * d.intensity) * (1 - calm * 0.88) * on;
      out.windX += d.dir * strength;
      out.turbulence += 0.6 * (1 - calm) * on;
      out.visibility *= 1 - 0.3 * on;
      out.envDmg += (1 - calm) * (0.6 + 0.9 * d.intensity) * on;
      break;
    }
    case 'hailstorm':
      if (on > 0 && !p.shieldActive) {
        for (const s of d.shafts) {
          if (s.warm < 1.5) continue;
          if (Math.abs(p.x - s.x) < s.w / 2 + PHYSICS.envelopeRadius * 0.6) {
            out.envDmg += 8 * k * on;
            out.basketDmg += 2.5 * k * on;
          }
        }
      }
      out.visibility *= 1 - 0.15 * on;
      break;
    case 'volcano':
      if (on > 0 && Math.abs(p.x - d.x) < d.width / 2 + PHYSICS.envelopeRadius * 0.6) {
        out.envDmg += 9 * k;
        out.equipDmg += 6;
        out.burnerEff *= 0.6;
        out.visibility *= 0.45;
        out.ay += 2.5;
      }
      out.visibility *= 1 - 0.15 * on;
      break;
    case 'iceStorm': {
      const inside = p.y + ENV_Y > d.bandBottom && p.y + ENV_Y < d.bandTop;
      if (inside && on > 0) {
        out.ice += (0.035 + 0.012 * d.intensity) * on;
        out.tempDelta -= 18 * on;
        out.visibility *= 0.7;
        out.windX += d.dir * 4;
      }
      break;
    }
    case 'microburst': {
      if (on <= 0) break;
      const dx = p.x - d.x;
      const dist = Math.abs(dx);
      const burst = d.phase === 'active' ? smoothstep(0, 0.6, d.elapsed) * (1 - smoothstep(d.duration - 2, d.duration, d.elapsed)) : on;
      if (dist < d.width / 2) {
        const prof = 1 - (dist / (d.width / 2)) ** 2;
        out.ay -= (17 + 6 * d.intensity) * prof * burst;
        out.envDmg += 2.5 * burst;
        out.turbulence += 0.4 * burst;
      } else if (dist < d.width) {
        out.ax += Math.sign(dx) * 7 * burst;
      }
      break;
    }
    case 'windShear': {
      const period = Math.max(1.6, 3.4 - 0.4 * d.intensity);
      const wave = Math.tanh(3 * Math.sin((t * Math.PI * 2) / period + d.seed));
      out.windX += wave * (8 + 4 * d.intensity) * on;
      out.turbulence += 0.6 * k * on;
      out.equipDmg += 0.8 * on;
      break;
    }
    case 'dustStorm': {
      const depth = d.bandTop - (p.y + ENV_Y);
      if (depth > 0 && on > 0) {
        const inside = clamp(depth / 15, 0, 1);
        out.visibility *= 1 - 0.65 * inside;
        out.equipDmg += 3 * k * inside;
        out.envDmg += 1.3 * k * inside;
        out.burnerEff *= 1 - 0.15 * inside;
        out.windX += d.dir * 5 * k * inside;
      }
      break;
    }
    case 'energyStorm':
      out.heatJitter += 0.06 * k * on;
      out.burnerEff *= 1 + Math.sin(t * 3.1) * 0.2 * on;
      out.turbulence += 0.3 * on;
      break;
  }
}
