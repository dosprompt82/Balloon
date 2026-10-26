import { ALTITUDE, DIFFICULTY, ECONOMY, PHYSICS, RESOURCES, TRAFFIC, COLLECT } from '../data/config';
import { ZONES, zoneIndexAt } from '../data/zones';
import { TOOLS, TOOL_TUNING, type ToolId } from '../data/tools';
import type { CollectibleId } from '../data/collectibles';
import type { DisasterId } from '../data/disasters';
import { noise1 } from './core/rng';
import { clamp } from './core/math';
import type { EndReason } from './core/types';
import { stepBalloon, type BalloonBody } from './physics/balloonPhysics';
import { altitudeFromY, altitudeScale, ambientTemperature, liftFactor, turbulenceAt, windAt, yFromAltitude } from './physics/atmosphere';
import { WeatherDirector, type PacingPhase } from './weather/director';
import { disasterEffect, emptyEffect, updateDisaster, type DisasterEffect, type DisasterInstance, type PlayerView } from './disasters/disasters';
import { Traffic, type Hazard } from './obstacles/traffic';
import { Collectibles } from './collectibles/collectibles';
import type { Loadout } from './progression/loadout';

export interface SimInput {
  burner: boolean;
  vent: boolean;
  boost: boolean;
  steer: number;
  useTool: boolean;
  switchTool: boolean;
  repair: boolean;
  bail: boolean;
}

export const emptyInput = (): SimInput => ({ burner: false, vent: false, boost: false, steer: 0, useTool: false, switchTool: false, repair: false, bail: false });

export type SimEvent =
  | { type: 'hit'; target: 'envelope' | 'basket'; x: number; y: number; amount: number; source: string }
  | { type: 'blocked'; x: number; y: number }
  | { type: 'nearMiss'; x: number; y: number; coins: number }
  | { type: 'collect'; id: CollectibleId; x: number; y: number; amount: number }
  | { type: 'strike'; x: number; y: number; hit: boolean; absorbed: boolean }
  | { type: 'arc'; x: number; y: number; blocked: boolean }
  | { type: 'warning'; disaster: DisasterInstance }
  | { type: 'disasterStart'; disaster: DisasterInstance }
  | { type: 'disasterEnd'; disaster: DisasterInstance; coins: number }
  | { type: 'zone'; zone: number }
  | { type: 'milestone'; altitude: number; coins: number }
  | { type: 'record'; altitude: number }
  | { type: 'tool'; tool: ToolId }
  | { type: 'toolEmpty' }
  | { type: 'repairStart' }
  | { type: 'repairDone' }
  | { type: 'repairFail'; reason: string }
  | { type: 'ground'; speed: number; damage: number }
  | { type: 'end'; reason: EndReason }
  | { type: 'alert'; text: string; level: 'info' | 'warn' | 'danger' };

export interface SimOptions {
  seed: number;
  previousBest: number;
}

export class FlightSim {
  readonly seed: number;
  readonly loadout: Loadout;
  readonly body: BalloonBody;
  readonly director: WeatherDirector;
  readonly traffic: Traffic;
  readonly collectibles: Collectibles;
  readonly previousBest: number;

  envelope: number;
  basket: number;
  oxygen: number;
  repairMaterials: number;
  repairing = 0;
  repairTotal = 1;
  toolCharges: Partial<Record<ToolId, number>>;
  toolIndex = 0;
  rodTimer = 0;
  shieldTimer = 0;
  thrustTimer = 0;
  invuln = 0;

  time = 0;
  altitude = 0;
  maxAltitude = 0;
  zoneIndex = 0;
  highestZone = 0;
  recordBroken = false;
  private milestoneIdx = 0;

  // run tallies
  coinsCollected = 0;
  nearMissCoins = 0;
  disasterCoins = 0;
  milestoneCoins = 0;
  absorbCoins = 0;
  shards = 0;
  relics = 0;
  disastersSurvived = 0;
  disasterCounts: Partial<Record<DisasterId, number>> = {};
  maxIntensity = -1;
  nearMisses = 0;
  hits = 0;
  repairs = 0;
  toolsUsed = 0;
  lightningAbsorbed = 0;

  // environment readouts
  windX = 0;
  ambientTemp = 15;
  cabinTemp = 15;
  visibility = 1;
  gloom = 0;
  fog = 1;
  turbulence = 0;
  effect: DisasterEffect = emptyEffect();
  burning = false;
  venting = false;
  boosting = false;
  steering = 0;
  hypoxic = false;
  lastHitTime = -10;
  lastNearMissTime = -10;

  ended = false;
  endReason: EndReason | null = null;
  dying = 0;
  private groundTime = 0;
  private noFuelTime = 0;
  private alertCooldown: Record<string, number> = {};
  events: SimEvent[] = [];

  constructor(loadout: Loadout, opts: SimOptions) {
    this.seed = opts.seed >>> 0;
    this.loadout = loadout;
    this.previousBest = opts.previousBest;
    const startY = yFromAltitude(loadout.flight.startAltitude);
    this.body = { x: 0, y: startY, vx: 0, vy: 0, heat: startY > 0 ? PHYSICS.heatNeutral : PHYSICS.startHeat, fuel: loadout.maxFuel, ice: 0, equipment: 100 };
    this.envelope = loadout.maxEnvelope;
    this.basket = loadout.maxBasket;
    this.oxygen = loadout.maxOxygen;
    this.repairMaterials = loadout.repairMaterials;
    this.toolCharges = { ...loadout.tools };
    const novice = loadout.playerLevel < 3;
    this.director = new WeatherDirector(this.seed, novice);
    this.traffic = new Traffic(this.seed, loadout.difficulty);
    this.collectibles = new Collectibles(this.seed, loadout.mods.rareChance);
    this.altitude = altitudeFromY(startY);
    this.maxAltitude = this.altitude;
    this.zoneIndex = this.highestZone = zoneIndexAt(this.altitude);
    while (this.milestoneIdx < ECONOMY.milestones.length && ECONOMY.milestones[this.milestoneIdx] <= this.altitude) this.milestoneIdx++;
  }

  get tools(): ToolId[] {
    return TOOLS.map((t) => t.id).filter((id) => (this.loadout.tools[id] ?? 0) > 0);
  }
  get currentTool(): ToolId | null {
    const t = this.tools;
    return t.length ? t[this.toolIndex % t.length] : null;
  }
  get pacing(): PacingPhase {
    return this.director.phase;
  }
  get nextMilestone(): number {
    return ECONOMY.milestones[this.milestoneIdx] ?? Math.ceil((this.maxAltitude + 1) / 100000) * 100000;
  }
  get climbRate(): number {
    return this.body.vy * altitudeScale(this.altitude);
  }
  get runCoins(): number {
    return Math.round(this.coinsCollected + this.nearMissCoins + this.disasterCoins + this.milestoneCoins + this.absorbCoins);
  }
  get repairCost(): number {
    return Math.max(1, Math.round(2 * this.loadout.mods.repairCost));
  }

  private emit(e: SimEvent) {
    this.events.push(e);
  }
  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
  private alert(key: string, text: string, level: 'info' | 'warn' | 'danger', cooldown = 8) {
    if ((this.alertCooldown[key] ?? -1e9) > this.time) return;
    this.alertCooldown[key] = this.time + cooldown;
    this.emit({ type: 'alert', text, level });
  }

  private damageScale() {
    return DIFFICULTY[this.loadout.difficulty].damage * this.loadout.flight.damage * this.loadout.mods.damageTaken;
  }

  applyDamage(env: number, basket: number) {
    const s = this.damageScale();
    this.envelope -= env * s;
    this.basket -= basket * s;
  }

  playerView(): PlayerView {
    return {
      x: this.body.x, y: this.body.y, vx: this.body.vx, vy: this.body.vy,
      rodActive: this.rodTimer > 0, shieldActive: this.shieldTimer > 0, tornadoImmune: this.thrustTimer > 0,
      warningMult: this.loadout.warningMult,
    };
  }

  step(dt: number, input: SimInput) {
    if (this.ended) return;
    this.time += dt;
    const b = this.body;
    const L = this.loadout;

    if (this.dying > 0) {
      // balloon is going down — keep simulating the fall for drama
      this.dying -= dt;
      b.vy -= 14 * dt;
      b.y += b.vy * dt;
      b.x += b.vx * dt;
      b.heat = Math.max(PHYSICS.heatAmbient, b.heat - dt);
      if (this.dying <= 0) this.finish();
      return;
    }

    // ---- environment & disasters ----
    const view = this.playerView();
    const fx = emptyEffect();
    const hooks = {
      spawnHazard: (id: Parameters<Traffic['spawn']>[0], x: number, y: number, vx: number, vy: number, tel: number) => {
        this.traffic.spawn(id, x, y, vx, vy, tel, true);
      },
      strike: (s: { x: number; y: number; r: number }, hit: boolean, absorbed: boolean, d: DisasterInstance) => {
        if (hit && absorbed) {
          this.lightningAbsorbed++;
          this.absorbCoins += 8 * L.mods.coinGain;
        } else if (hit) {
          const mult = this.shieldTimer > 0 ? 0.5 : 1;
          this.applyDamage(13 * d.k * mult, 4 * d.k * mult);
          b.equipment = Math.max(0, b.equipment - 12 * mult);
          this.hits++;
          this.lastHitTime = this.time;
        } else {
          const dist = Math.hypot(b.x - s.x, b.y + PHYSICS.envelopeOffsetY - s.y);
          if (dist < s.r + PHYSICS.envelopeRadius + 7) this.nearMiss(s.x, s.y);
        }
        this.emit({ type: 'strike', x: s.x, y: s.y, hit, absorbed });
      },
      arcHit: (d: DisasterInstance) => {
        const blocked = this.shieldTimer > 0;
        if (!blocked) {
          this.applyDamage(15 * d.k, 6 * d.k);
          b.equipment = Math.max(0, b.equipment - 10);
          this.hits++;
          this.lastHitTime = this.time;
        }
        this.emit({ type: 'arc', x: b.x, y: b.y + PHYSICS.envelopeOffsetY, blocked });
      },
    };
    for (const d of this.director.active) {
      updateDisaster(d, view, dt, hooks);
      disasterEffect(d, view, fx);
    }
    this.effect = fx;
    const healthFrac = Math.min(this.envelope / L.maxEnvelope, this.basket / L.maxBasket);
    for (const ev of this.director.update(dt, {
      altitude: this.altitude, flightTime: this.time, healthFrac, fuelFrac: b.fuel / L.maxFuel,
      playerLevel: L.playerLevel, difficulty: L.difficulty, disasterRate: L.flight.disasterRate,
      intensityMult: L.flight.intensity, player: view,
    })) {
      if (ev.type === 'warning') this.emit({ type: 'warning', disaster: ev.disaster });
      else if (ev.type === 'start') this.emit({ type: 'disasterStart', disaster: ev.disaster });
      else if (ev.type === 'end') {
        const d = ev.disaster;
        const coins = ECONOMY.disasterSurvivalBase * (1 + d.intensity) * (d.def.major ? 1.6 : 1) * L.mods.coinGain;
        this.disasterCoins += coins;
        this.disastersSurvived++;
        this.disasterCounts[d.id] = (this.disasterCounts[d.id] ?? 0) + 1;
        this.maxIntensity = Math.max(this.maxIntensity, d.intensity);
        this.emit({ type: 'disasterEnd', disaster: d, coins: Math.round(coins) });
      } else if (ev.type === 'reward') {
        const last = this.director.history.length;
        this.collectibles.spawnReward(b.x + b.vx * 2, b.y, Math.min(4, Math.floor(last / 3)));
      }
    }

    const ambientWind = windAt(b.y, this.altitude, this.time, this.seed);
    const turb = turbulenceAt(this.altitude, this.time, this.seed);
    this.windX = ambientWind + fx.windX;
    this.turbulence = turb.level + fx.turbulence;
    const tx = noise1(this.time * 1.9, this.seed + 101) * this.turbulence * 3.2;
    const ty = noise1(this.time * 1.4, this.seed + 202) * this.turbulence * 2.2;

    // ---- temperature, ice, equipment ----
    this.ambientTemp = ambientTemperature(this.altitude) + fx.tempDelta;
    this.cabinTemp = this.ambientTemp + L.coldResist + (this.burning ? 10 : 0);
    const coldExcess = Math.max(0, RESOURCES.coldThreshold - this.cabinTemp);
    b.equipment -= (coldExcess / 10) * RESOURCES.coldEquipmentDamage * dt;
    b.equipment -= fx.equipDmg * dt;
    b.ice += (coldExcess * RESOURCES.iceRatePerColdDegree + fx.ice * Math.max(0.15, 1 - L.coldResist / 70)) * dt;
    if (this.burning) b.ice -= RESOURCES.burnerMeltRate * dt;
    if (this.ambientTemp > 2) b.ice -= 0.02 * dt;
    b.ice = clamp(b.ice, 0, 1.5);
    b.equipment = clamp(b.equipment, 0, 100);
    if (b.ice > 0.6) this.alert('ice', 'Heavy ice! Lift is dropping — burn hot or use the De-Icer.', 'warn');
    if (b.equipment < RESOURCES.equipmentFailureThreshold) this.alert('equip', 'Equipment failing — press E to repair!', 'danger');

    const iceEff = Math.min(1, b.ice);
    let burnerEff = fx.burnerEff * (1 - 0.25 * iceEff) * (b.equipment < RESOURCES.equipmentFailureThreshold ? 0.45 + 0.55 * Math.max(0, noise1(this.time * 4, this.seed + 9)) : 1 - (100 - b.equipment) * 0.002);
    if (coldExcess > 0) burnerEff *= Math.max(0.6, 1 - coldExcess * 0.008);
    const valveEff = 1 - 0.45 * iceEff;
    if (fx.heatJitter) b.heat += noise1(this.time * 5, this.seed + 33) * fx.heatJitter * dt * 6;

    // ---- gravity anomalies & hazard fields ----
    let fieldAy = 0;
    this.traffic.pool.forEachAlive((h) => {
      if (h.def.pattern !== 'drift' || h.telegraph > 0) return;
      const d = Math.hypot(h.x - b.x, h.y - (b.y + PHYSICS.envelopeOffsetY));
      if (d < h.def.radius * 2.4) fieldAy += Math.sin(this.time * 2.7 + h.phase) * 13;
    });

    // ---- tools, repair ----
    this.handleTools(input);
    this.handleRepair(dt, input);

    // ---- physics ----
    const out = stepBalloon(
      b,
      { burner: input.burner && this.repairing <= 0, vent: input.vent, boost: input.boost, steer: input.steer },
      {
        windX: this.windX,
        accelX: fx.ax + tx,
        accelY: fx.ay + ty + fieldAy,
        liftFactor: liftFactor(this.altitude, L.thinAirResist),
        burnerEfficiency: burnerEff,
        valveEfficiency: valveEff,
      },
      { burnerMult: L.burnerMult, liftMult: L.liftMult, steerAccel: L.steerAccel, fuelUse: L.mods.fuelUse, heatMaxMult: 1 + (L.burnerMult - 1) * 0.9 },
      dt,
    );
    this.burning = out.burning;
    this.venting = input.vent;
    this.boosting = out.burning && input.boost;
    this.steering = input.steer;
    if (b.fuel <= 0) this.alert('nofuel', 'Out of fuel! Grab a canister or press Enter to parachute down.', 'danger', 12);
    else if (b.fuel < L.maxFuel * 0.2) this.alert('lowfuel', 'Fuel low — look for red fuel canisters.', 'warn', 15);

    // ---- ground ----
    if (b.y <= 0) {
      const impact = -b.vy;
      b.y = 0;
      if (impact > PHYSICS.groundCrashSpeed) {
        const dmg = (impact - PHYSICS.groundCrashSpeed) * PHYSICS.groundDamagePerSpeed;
        this.basket -= dmg;
        this.envelope -= dmg * 0.4;
        this.emit({ type: 'ground', speed: impact, damage: dmg });
        if (this.basket <= 0) return this.die('crash');
      }
      b.vy = Math.max(0, b.vy);
      b.vx *= 1 - Math.min(1, 3 * dt);
      if (this.maxAltitude >= ALTITUDE.minAltitudeForLanding && this.time > 5 && !this.burning) {
        this.groundTime += dt;
        if (this.groundTime > 1.5) {
          this.endReason = 'landing';
          this.finish();
          return;
        }
      }
    } else this.groundTime = 0;

    // ---- altitude & progress ----
    this.altitude = altitudeFromY(b.y);
    if (this.altitude > this.maxAltitude) {
      this.maxAltitude = this.altitude;
      while (this.milestoneIdx < ECONOMY.milestones.length && this.maxAltitude >= ECONOMY.milestones[this.milestoneIdx]) {
        const m = ECONOMY.milestones[this.milestoneIdx++];
        const coins = Math.round(m / 100);
        this.milestoneCoins += coins;
        this.emit({ type: 'milestone', altitude: m, coins });
      }
      if (!this.recordBroken && this.previousBest > 0 && this.maxAltitude > this.previousBest) {
        this.recordBroken = true;
        this.emit({ type: 'record', altitude: this.maxAltitude });
      }
    }
    const zi = zoneIndexAt(this.altitude);
    if (zi !== this.zoneIndex) {
      this.zoneIndex = zi;
      if (zi > this.highestZone) {
        this.highestZone = zi;
        this.emit({ type: 'zone', zone: zi });
      }
    }

    // ---- oxygen ----
    if (this.altitude >= RESOURCES.oxygenStartAltitude) {
      const use = RESOURCES.oxygenUsePerSecond * L.mods.oxygenUse * (1 + (this.altitude - RESOURCES.oxygenStartAltitude) / 50000);
      this.oxygen = Math.max(0, this.oxygen - use * dt);
      if (this.oxygen < L.maxOxygen * 0.25 && this.oxygen > 0) this.alert('o2', 'Oxygen low — collect blue O₂ bubbles!', 'warn', 15);
    } else this.oxygen = Math.min(L.maxOxygen, this.oxygen + 6 * dt);
    this.hypoxic = this.oxygen <= 0;
    if (this.hypoxic) {
      this.basket -= RESOURCES.hypoxiaDamage * dt * DIFFICULTY[L.difficulty].damage;
      this.alert('hypoxia', 'No oxygen! The crew is weakening — descend or find O₂.', 'danger', 10);
    }

    // ---- continuous disaster damage ----
    if (fx.envDmg > 0 || fx.basketDmg > 0) {
      this.applyDamage(fx.envDmg * dt, fx.basketDmg * dt);
      if (this.time - this.lastHitTime > 0.6) {
        this.lastHitTime = this.time;
        this.emit({ type: 'hit', target: 'envelope', x: b.x, y: b.y + PHYSICS.envelopeOffsetY, amount: fx.envDmg, source: 'storm' });
      }
    }
    this.visibility = clamp(fx.visibility * L.visibility, 0.15, 1);
    this.gloom = fx.gloom;
    this.fog = fx.fog / L.visibility;

    // ---- traffic & collectibles ----
    const phaseRate: Record<PacingPhase, number> = { calm: 1, warning: 0.7, active: 0.45, resolve: 0.6, reward: 0.25 };
    this.traffic.update(dt, this.altitude, b.x, b.y, b.vy, phaseRate[this.director.phase] * (this.altitude < 150 ? 0.4 : 1));
    this.collideHazards();
    this.collectibles.update(
      dt, this.altitude, b.x, b.y, this.windX,
      1 - b.fuel / L.maxFuel, 1 - this.envelope / L.maxEnvelope,
      this.altitude > 5000 ? 1 - this.oxygen / L.maxOxygen : 0,
    );
    this.collect(dt);

    // ---- timers ----
    this.rodTimer = Math.max(0, this.rodTimer - dt);
    this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    this.thrustTimer = Math.max(0, this.thrustTimer - dt);
    this.invuln = Math.max(0, this.invuln - dt);

    // ---- end conditions ----
    if (this.envelope <= 0) return this.die('envelope');
    if (this.basket <= 0) return this.die('basket');
    if (b.fuel <= 0 && b.vy <= 0.5) {
      this.noFuelTime += dt;
      if (input.bail || this.noFuelTime > 30) {
        this.endReason = 'fuel';
        this.finish();
      }
    } else this.noFuelTime = 0;
  }

  private die(reason: EndReason) {
    this.envelope = Math.max(0, this.envelope);
    this.basket = Math.max(0, this.basket);
    this.endReason = reason;
    this.dying = reason === 'crash' ? 1 : 2.6;
    this.body.vy = Math.min(this.body.vy, 0);
  }

  private finish() {
    if (this.ended) return;
    this.ended = true;
    this.emit({ type: 'end', reason: this.endReason ?? 'abandoned' });
  }

  abandon() {
    this.endReason = 'abandoned';
    this.finish();
  }

  private nearMiss(x: number, y: number) {
    const coins = ECONOMY.nearMissCoins * this.loadout.mods.nearMissReward * this.loadout.mods.coinGain;
    this.nearMisses++;
    this.nearMissCoins += coins;
    this.lastNearMissTime = this.time;
    this.emit({ type: 'nearMiss', x, y, coins: Math.round(coins) });
  }

  private handleTools(input: SimInput) {
    const tools = this.tools;
    if (input.switchTool && tools.length) this.toolIndex = (this.toolIndex + 1) % tools.length;
    if (!input.useTool) return;
    const tool = this.currentTool;
    if (!tool) return;
    if ((this.toolCharges[tool] ?? 0) <= 0) {
      this.emit({ type: 'toolEmpty' });
      return;
    }
    const b = this.body;
    this.toolCharges[tool]! -= 1;
    this.toolsUsed++;
    switch (tool) {
      case 'ballast':
        b.vy = Math.max(b.vy, 0) + TOOL_TUNING.ballastImpulse;
        b.heat += TOOL_TUNING.ballastHeat;
        break;
      case 'lightningRod':
        this.rodTimer = TOOLS.find((t) => t.id === tool)!.duration;
        break;
      case 'shield':
        this.shieldTimer = TOOLS.find((t) => t.id === tool)!.duration;
        break;
      case 'deicer':
        b.ice = 0;
        b.equipment = Math.min(100, b.equipment + 10);
        break;
      case 'thruster': {
        let dir = Math.sign(this.steering);
        if (!dir) {
          const tornado = this.director.active.find((d) => d.id === 'tornado');
          dir = tornado ? Math.sign(b.x - tornado.x) || 1 : Math.sign(b.vx) || 1;
        }
        b.vx += dir * TOOL_TUNING.thrusterImpulse;
        this.thrustTimer = TOOL_TUNING.thrusterTornadoImmunity;
        break;
      }
    }
    this.emit({ type: 'tool', tool });
  }

  private handleRepair(dt: number, input: SimInput) {
    const L = this.loadout;
    const b = this.body;
    if (this.repairing > 0) {
      this.repairing -= dt;
      if (this.repairing <= 0) {
        this.repairing = 0;
        this.envelope = Math.min(L.maxEnvelope, this.envelope + RESOURCES.repairAmount);
        this.basket = Math.min(L.maxBasket, this.basket + RESOURCES.repairAmount * 0.6);
        b.equipment = Math.min(100, b.equipment + 30);
        b.ice = Math.max(0, b.ice - 0.3);
        this.repairs++;
        this.emit({ type: 'repairDone' });
      }
      return;
    }
    if (!input.repair) return;
    const damaged = this.envelope < L.maxEnvelope - 1 || this.basket < L.maxBasket - 1 || b.equipment < 99 || b.ice > 0.1;
    if (!damaged) return this.emit({ type: 'repairFail', reason: 'Nothing needs repairing' });
    if (this.repairMaterials < this.repairCost) return this.emit({ type: 'repairFail', reason: 'Not enough repair materials' });
    this.repairMaterials -= this.repairCost;
    this.repairTotal = this.repairing = RESOURCES.repairDuration / L.repairSpeed;
    this.emit({ type: 'repairStart' });
  }

  private collideHazards() {
    const b = this.body;
    const R = PHYSICS.envelopeRadius * this.loadout.balloon.scale;
    const ey = b.y + PHYSICS.envelopeOffsetY * this.loadout.balloon.scale;
    const by = b.y + 1;
    this.traffic.pool.forEachAlive((h: Hazard) => {
      if (h.telegraph > 0 || h.hasHit || h.def.pattern === 'drift') return;
      const de = Math.hypot(h.x - b.x, h.y - ey) - (R + h.def.radius);
      const db = h.def.hitsBasket ? Math.hypot(h.x - b.x, h.y - by) - (PHYSICS.basketRadius + h.def.radius) : Infinity;
      const clear = Math.min(de, db);
      if (clear < 0) {
        h.hasHit = true;
        if (this.shieldTimer > 0) {
          h.alive = false;
          this.emit({ type: 'blocked', x: h.x, y: h.y });
          return;
        }
        if (this.invuln > 0) return;
        const target = db < de ? 'basket' : 'envelope';
        const dmg = h.def.damage;
        if (target === 'basket') this.applyDamage(dmg * 0.3, dmg * 0.8);
        else this.applyDamage(dmg, dmg * 0.15);
        this.hits++;
        this.invuln = 0.5;
        this.lastHitTime = this.time;
        const push = Math.sign(b.x - h.x) || 1;
        b.vx += push * 5 + h.vx * 0.25;
        b.vy += Math.max(-4, h.vy * 0.15) - 1;
        if (['birds', 'geese', 'drone', 'iceShard', 'meteor', 'lavaBomb', 'debris', 'cargo', 'skyJelly', 'weatherBalloon'].includes(h.def.id)) h.alive = false;
        this.emit({ type: 'hit', target, x: h.x, y: h.y, amount: dmg, source: h.def.name });
        return;
      }
      if (clear < h.minDist) h.minDist = clear;
      else if (!h.nearMissed && h.minDist < TRAFFIC.nearMissMargin && clear > h.minDist + 1.5) {
        h.nearMissed = true;
        this.nearMiss(h.x, h.y);
      }
    });
  }

  private collect(dt: number) {
    const b = this.body;
    const L = this.loadout;
    const R = PHYSICS.envelopeRadius * L.balloon.scale;
    const ey = b.y + PHYSICS.envelopeOffsetY * L.balloon.scale;
    const magnet = L.magnetRadius;
    this.collectibles.pool.forEachAlive((c) => {
      const de = Math.hypot(c.x - b.x, c.y - ey);
      const db = Math.hypot(c.x - b.x, c.y - b.y);
      if (magnet > 0 && Math.min(de - R, db) < magnet + COLLECT.pickupRadius) {
        const tx = b.x - c.x;
        const ty = b.y + 4 - c.y;
        const len = Math.hypot(tx, ty) || 1;
        c.x += (tx / len) * 30 * dt;
        c.y += (ty / len) * 30 * dt;
      }
      if (de < R + 1.5 || db < COLLECT.pickupRadius) {
        c.alive = false;
        let amount = c.def.amount;
        switch (c.def.id) {
          case 'coin':
          case 'bigCoin':
            amount = c.def.amount * L.mods.coinGain * L.flight.coins;
            this.coinsCollected += amount;
            break;
          case 'fuel':
            b.fuel = Math.min(L.maxFuel, b.fuel + (L.maxFuel * c.def.amount) / 100);
            break;
          case 'repair':
            this.repairMaterials += c.def.amount;
            break;
          case 'oxygen':
            this.oxygen = Math.min(L.maxOxygen, this.oxygen + (L.maxOxygen * c.def.amount) / 100);
            break;
          case 'shard':
            this.shards += 1;
            break;
          case 'relic':
            this.relics += 1;
            this.coinsCollected += ECONOMY.relicCoins;
            amount = ECONOMY.relicCoins;
            break;
        }
        this.emit({ type: 'collect', id: c.def.id, x: c.x, y: c.y, amount: Math.round(amount) });
      }
    });
  }

  get zone() {
    return ZONES[this.zoneIndex];
  }
}
