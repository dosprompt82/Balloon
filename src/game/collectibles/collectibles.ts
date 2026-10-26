import { COLLECTIBLES, type CollectibleDef, type CollectibleId } from '../../data/collectibles';
import { COLLECT } from '../../data/config';
import { Pool } from '../core/pool';
import { Rng } from '../core/rng';

export interface Collectible {
  alive: boolean;
  uid: number;
  def: CollectibleDef;
  x: number;
  y: number;
  t: number;
}

let uid = 1;

export class Collectibles {
  readonly pool = new Pool<Collectible>(() => ({ alive: false, uid: 0, def: COLLECTIBLES[0], x: 0, y: 0, t: 0 }));
  private timer = 1;
  private rng: Rng;
  constructor(seed: number, private rareMult: number) {
    this.rng = new Rng(seed ^ 0xc011ec7);
  }

  spawn(id: CollectibleId, x: number, y: number) {
    const c = this.pool.acquire();
    c.alive = true;
    c.uid = uid++;
    c.def = COLLECTIBLES.find((d) => d.id === id)!;
    c.x = x;
    c.y = y;
    c.t = 0;
    return c;
  }

  update(dt: number, altitude: number, px: number, py: number, windX: number, needFuel: number, needRepair: number, needO2: number) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = COLLECT.spawnInterval * this.rng.range(0.6, 1.4);
      if (this.pool.activeCount < COLLECT.maxActive) this.spawnAmbient(altitude, px, py, windX, needFuel, needRepair, needO2);
    }
    this.pool.forEachAlive((c) => {
      c.t += dt;
      if ((c.x - px) ** 2 + (c.y - py) ** 2 > 220 ** 2) c.alive = false;
    });
  }

  private spawnAmbient(altitude: number, px: number, py: number, windX: number, needFuel: number, needRepair: number, needO2: number) {
    const rng = this.rng;
    const pool = COLLECTIBLES.filter((c) => altitude >= c.minAlt);
    const def = rng.weighted(pool, (c) => {
      let w = c.weight;
      if (c.rare) w *= this.rareMult;
      // gently help players who are running low — pity weighting
      if (c.id === 'fuel') w *= 1 + needFuel * 2.5;
      if (c.id === 'repair') w *= 1 + needRepair * 2;
      if (c.id === 'oxygen') w *= 1 + needO2 * 2.5;
      return w;
    })!;
    const y = py + rng.range(COLLECT.aheadMin, COLLECT.aheadMax);
    const drift = windX * 2.2;
    const x = px + drift + rng.range(-COLLECT.lateralSpread, COLLECT.lateralSpread);
    if (def.id === 'coin' && rng.chance(0.45)) {
      // coin trail: an arc to fly through
      const n = rng.int(5, 9);
      const dx = rng.range(-3, 3);
      for (let i = 0; i < n; i++) this.spawn('coin', x + dx * i + Math.sin(i * 0.6) * 4, y + i * 4.5);
    } else this.spawn(def.id, x, y);
  }

  /** A celebratory cluster after surviving a disaster. */
  spawnReward(px: number, py: number, intensity: number) {
    const rng = this.rng;
    const n = 6 + intensity * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.spawn(i % 4 === 0 ? 'bigCoin' : 'coin', px + Math.cos(a) * 14, py + 40 + Math.sin(a) * 10 + i * 1.5);
    }
    this.spawn('fuel', px + rng.range(-10, 10), py + 55);
    this.spawn('repair', px + rng.range(-12, 12), py + 70);
    if (rng.chance(0.25 * this.rareMult + intensity * 0.05)) this.spawn('shard', px, py + 85);
  }
}
