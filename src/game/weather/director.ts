import { DISASTERS, type DisasterDef, type DisasterId } from '../../data/disasters';
import { DIFFICULTY, PACING, type Difficulty } from '../../data/config';
import { Rng } from '../core/rng';
import { clamp } from '../core/math';
import { zoneIndexAt } from '../../data/zones';
import { createDisaster, type DisasterInstance, type PlayerView } from '../disasters/disasters';

export type PacingPhase = 'calm' | 'warning' | 'active' | 'resolve' | 'reward';

export interface DirectorContext {
  altitude: number;
  flightTime: number;
  healthFrac: number;
  fuelFrac: number;
  playerLevel: number;
  difficulty: Difficulty;
  disasterRate: number;
  intensityMult: number;
  player: PlayerView;
}

export type DirectorEvent =
  | { type: 'warning'; disaster: DisasterInstance }
  | { type: 'start'; disaster: DisasterInstance }
  | { type: 'end'; disaster: DisasterInstance }
  | { type: 'reward' };

/**
 * Paces the flight: calm → warning → active danger → resolve → reward → calm.
 * Deterministic for a given seed and input sequence.
 */
export class WeatherDirector {
  phase: PacingPhase = 'calm';
  timer: number;
  primary: DisasterInstance | null = null;
  secondary: DisasterInstance | null = null;
  history: DisasterId[] = [];
  private rng: Rng;
  private count = 0;
  private forced: { id: DisasterId; intensity: number } | null = null;

  /** Debug/testing: make the next calm phase end now with a specific disaster. */
  force(id: DisasterId, intensity: number) {
    this.forced = { id, intensity };
    if (this.phase === 'calm' || this.phase === 'reward') {
      this.phase = 'calm';
      this.timer = 0;
    }
  }

  constructor(seed: number, private novice: boolean) {
    this.rng = new Rng(seed ^ 0x5eed);
    this.timer = PACING.firstEventDelay + (novice ? 4 : 0);
  }

  get active(): DisasterInstance[] {
    const out: DisasterInstance[] = [];
    if (this.primary) out.push(this.primary);
    if (this.secondary) out.push(this.secondary);
    return out;
  }

  /** Called by the sim once per step after disasters updated; drives phase transitions. */
  update(dt: number, ctx: DirectorContext): DirectorEvent[] {
    const ev: DirectorEvent[] = [];
    this.timer -= dt;
    switch (this.phase) {
      case 'calm':
        if (this.timer <= 0 && this.count === 0 && !this.forced && ctx.altitude < PACING.firstEventMinAltitude) {
          this.timer = 2;
        } else if (this.timer <= 0) {
          const d = this.chooseDisaster(ctx);
          if (d) {
            this.primary = d;
            this.phase = 'warning';
            ev.push({ type: 'warning', disaster: d });
            // late-game hazard combinations
            if (ctx.altitude > 100000 || (ctx.altitude > 60000 && this.rng.chance(0.25))) {
              const s = this.chooseDisaster(ctx, d);
              if (s) {
                this.secondary = s;
                ev.push({ type: 'warning', disaster: s });
              }
            }
          } else this.timer = 4;
        }
        break;
      case 'warning':
        if (this.primary && this.primary.phase === 'active') {
          this.phase = 'active';
          ev.push({ type: 'start', disaster: this.primary });
        }
        break;
      case 'active':
        if (this.primary && (this.primary.phase === 'ending' || this.primary.phase === 'done')) {
          this.phase = 'resolve';
          this.timer = PACING.resolveTime;
        }
        break;
      case 'resolve':
        if (this.timer <= 0 && (!this.primary || this.primary.phase === 'done')) {
          if (this.primary) ev.push({ type: 'end', disaster: this.primary });
          if (this.secondary) ev.push({ type: 'end', disaster: this.secondary });
          this.primary = null;
          this.secondary = null;
          this.phase = 'reward';
          this.timer = PACING.rewardTime;
          ev.push({ type: 'reward' });
        }
        break;
      case 'reward':
        if (this.timer <= 0) {
          this.phase = 'calm';
          this.timer = this.calmDuration(ctx);
        }
        break;
    }
    if (this.secondary && this.secondary.phase === 'done' && this.phase !== 'resolve') {
      ev.push({ type: 'end', disaster: this.secondary });
      this.secondary = null;
    }
    return ev;
  }

  calmDuration(ctx: DirectorContext): number {
    const km = ctx.altitude / 1000;
    let t = this.rng.range(PACING.calmMin, PACING.calmMax) - km * PACING.calmShrinkPerKm * 10;
    t = Math.max(PACING.calmFloor, t);
    if (this.novice) t += PACING.noviceCalmBonus;
    if (ctx.healthFrac < 0.35) t += 5;
    return t / Math.max(0.2, ctx.disasterRate);
  }

  intensityFor(ctx: DirectorContext, def: DisasterDef): number {
    const z = zoneIndexAt(ctx.altitude);
    let base = z * 0.36 + ctx.flightTime / 260 + this.count * 0.08;
    if (ctx.healthFrac > 0.75) base += 0.25;
    if (ctx.healthFrac < 0.35) base -= 1 * PACING.lowHealthEase * 2;
    if (this.novice) base = base * PACING.noviceIntensityPenalty - 0.5;
    base *= DIFFICULTY[ctx.difficulty].intensity * ctx.intensityMult;
    if (def.major) base -= 0.3;
    base += this.rng.range(-0.7, 0.7);
    let i = clamp(Math.round(base), 0, 4);
    if (ctx.altitude > 100000) i = Math.max(i, 2 + (this.rng.chance(0.35) ? 2 : 1));
    return clamp(i, 0, 4);
  }

  eligible(ctx: DirectorContext, exclude?: DisasterInstance): DisasterDef[] {
    return DISASTERS.filter((d) => {
      if (ctx.altitude < d.minAlt || ctx.altitude > d.maxAlt) return false;
      if (d.major && ctx.flightTime < 40) return false;
      if (exclude) {
        if (d.id === exclude.id) return false;
        if (d.major && exclude.def.major) return false;
        // avoid stacking two disasters that both blanket visibility or both own the wind field
        const field = ['hurricane', 'windShear', 'dustStorm', 'iceStorm'];
        if (field.includes(d.id) && field.includes(exclude.id)) return false;
      }
      return true;
    });
  }

  chooseDisaster(ctx: DirectorContext, exclude?: DisasterInstance): DisasterInstance | null {
    if (this.forced && !exclude) {
      const f = this.forced;
      this.forced = null;
      this.history.push(f.id);
      this.count++;
      return createDisaster(f.id, f.intensity, ctx.player, Math.floor(this.rng.next() * 2 ** 31), PACING.warningTime * ctx.player.warningMult);
    }
    const pool = this.eligible(ctx, exclude);
    const last = this.history[this.history.length - 1];
    const prev = this.history[this.history.length - 2];
    const def = this.rng.weighted(pool, (d) => {
      let w = d.weight;
      if (d.id === last) w *= pool.length > 1 ? 0 : 1;
      if (d.id === prev) w *= 0.35;
      // favour signature disasters in their home zone
      const mid = d.maxAlt === Infinity ? d.minAlt * 1.5 : (d.minAlt + d.maxAlt) / 2;
      w *= 1 + 0.6 * Math.exp(-Math.abs(Math.log((ctx.altitude + 500) / (mid + 500))));
      return w;
    });
    if (!def) return null;
    const intensity = this.intensityFor(ctx, def);
    const warn = PACING.warningTime * ctx.player.warningMult * (def.major ? 1.25 : 1) * (this.novice ? 1.3 : 1);
    this.history.push(def.id);
    this.count++;
    return createDisaster(def.id, intensity, ctx.player, Math.floor(this.rng.next() * 2 ** 31), warn);
  }
}
