import { OBSTACLES, obstacleDef, type ObstacleDef, type ObstacleId } from '../../data/obstacles';
import { TRAFFIC, DIFFICULTY, type Difficulty } from '../../data/config';
import { Pool } from '../core/pool';
import { Rng } from '../core/rng';
import { zoneIndexAt } from '../../data/zones';

export interface Hazard {
  alive: boolean;
  uid: number;
  def: ObstacleDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseY: number;
  t: number;
  phase: number;
  telegraph: number;
  minDist: number;
  nearMissed: boolean;
  hasHit: boolean;
  warned: boolean;
}

let uid = 1;

export class Traffic {
  readonly pool = new Pool<Hazard>(() => ({
    alive: false, uid: 0, def: OBSTACLES[0], x: 0, y: 0, vx: 0, vy: 0, baseY: 0, t: 0, phase: 0,
    telegraph: 0, minDist: Infinity, nearMissed: false, hasHit: false, warned: false,
  }));
  private timer = 6;
  private rng: Rng;

  constructor(seed: number, private difficulty: Difficulty) {
    this.rng = new Rng(seed ^ 0x7aff1c);
  }

  spawn(id: ObstacleId, x: number, y: number, vx: number, vy: number, telegraph = 0, fromDisaster = false): Hazard {
    const h = this.pool.acquire();
    h.alive = true;
    h.uid = uid++;
    h.def = obstacleDef(id, fromDisaster);
    h.x = x;
    h.y = y;
    h.vx = vx;
    h.vy = vy;
    h.baseY = y;
    h.t = 0;
    h.phase = this.rng.range(0, Math.PI * 2);
    h.telegraph = telegraph;
    h.minDist = Infinity;
    h.nearMissed = false;
    h.hasHit = false;
    h.warned = false;
    return h;
  }

  /** Spawn ambient traffic around the player, respecting a minimum reaction window. */
  update(dt: number, altitude: number, px: number, py: number, pvy: number, rate: number) {
    this.timer -= dt * rate * DIFFICULTY[this.difficulty].spawn;
    if (this.timer <= 0) {
      const z = zoneIndexAt(altitude);
      this.timer = Math.max(TRAFFIC.minSpawnInterval, TRAFFIC.baseSpawnInterval - z * TRAFFIC.intervalShrinkPerZone) * this.rng.range(0.7, 1.3);
      if (this.pool.activeCount < TRAFFIC.maxActive) this.spawnAmbient(altitude, px, py, pvy);
    }
    this.pool.forEachAlive((h) => {
      h.t += dt;
      if (h.telegraph > 0) {
        h.telegraph -= dt;
        return;
      }
      switch (h.def.pattern) {
        case 'bob':
          h.y = h.baseY + Math.sin(h.t * 2 + h.phase) * 3;
          h.x += h.vx * dt;
          h.baseY += h.vy * dt;
          break;
        case 'zigzag':
          h.y = h.baseY + Math.sin(h.t * 1.6 + h.phase) * 7;
          h.x += h.vx * dt;
          break;
        case 'pulse':
          h.y = h.baseY + Math.sin(h.t * 0.9 + h.phase) * 6;
          h.x += h.vx * dt;
          break;
        case 'ballistic':
          h.vy -= 13 * dt;
          h.x += h.vx * dt;
          h.y += h.vy * dt;
          break;
        default:
          h.x += h.vx * dt;
          h.y += h.vy * dt;
      }
      const dx = h.x - px;
      const dy = h.y - py;
      if (dx * dx + dy * dy > TRAFFIC.despawnDistance ** 2) h.alive = false;
    });
  }

  private spawnAmbient(altitude: number, px: number, py: number, pvy: number) {
    const rng = this.rng;
    const pool = OBSTACLES.filter((o) => o.weight > 0 && altitude >= o.minAlt && altitude <= o.maxAlt);
    const def = rng.weighted(pool, (o) => o.weight);
    if (!def) return;
    const speed = rng.range(def.speed[0], def.speed[1]);
    const climb = Math.max(0, pvy);
    const side = rng.sign();
    // horizontal distance such that time-to-reach ≥ reaction window
    const lateral = Math.max(TRAFFIC.spawnDistanceX, speed * TRAFFIC.reactionWindow + 25);
    switch (def.pattern) {
      case 'cross':
      case 'bob':
      case 'zigzag':
      case 'pulse': {
        const y = py + rng.range(15, 45) + climb * rng.range(1.5, 3.5);
        this.spawn(def.id, px + side * lateral, y, -side * speed, 0);
        if (def.id === 'birds' || def.id === 'geese') {
          // a loose formation behind the leader
          const n = def.id === 'geese' ? 4 : 2;
          for (let i = 1; i <= n; i++) {
            this.spawn(def.id, px + side * (lateral + i * 6), y + (i % 2 ? 3 : -3) * Math.ceil(i / 2), -side * speed, 0);
          }
        }
        break;
      }
      case 'diagonal': {
        const y = py + rng.range(60, 100) + climb * 2;
        this.spawn(def.id, px + side * lateral, y, -side * speed * 0.8, -speed * 0.55);
        break;
      }
      case 'fall': {
        let x = px + rng.range(-35, 35);
        if (Math.abs(x - px) < 4) x += side * 8;
        this.spawn(def.id, x, py + rng.range(95, 135) + climb * 2, rng.range(-2, 2), -speed);
        break;
      }
      case 'rise': {
        this.spawn(def.id, px + rng.range(-40, 40), py + rng.range(80, 130), rng.range(-1.5, 1.5), speed * 0.3);
        break;
      }
      case 'drift': {
        this.spawn(def.id, px + side * rng.range(30, 60), py + rng.range(70, 120), -side * speed, 0);
        break;
      }
      default:
        break;
    }
  }
}
