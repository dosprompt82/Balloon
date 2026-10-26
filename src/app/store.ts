import { create } from 'zustand';
import { loadSave, writeSave, defaultSave, type SaveData, type Settings, type Customization } from '../game/persistence/save';
import { UPGRADES } from '../data/upgrades';
import { BALLOONS } from '../data/balloons';
import { CHARACTERS, type CharacterDef } from '../data/characters';
import { ACCESSORIES } from '../data/cosmetics';
import { ACHIEVEMENTS } from '../data/achievements';
import { MISSIONS, CHALLENGE_FLIGHTS, dailyChallenge } from '../data/challenges';
import { buildLoadout } from '../game/progression/loadout';
import { applyXp, computeRewards } from '../game/economy/rewards';
import type { FlightModifiers, RunResult } from '../game/core/types';
import type { FlightSim } from '../game/simulation';
import type { ToolId } from '../data/tools';
import { hashString } from '../game/core/rng';

export type Screen =
  | 'menu' | 'character' | 'garage' | 'upgrades' | 'challenges' | 'achievements' | 'stats'
  | 'settings' | 'howto' | 'prep' | 'flight' | 'results';

export interface HudWarning {
  name: string;
  icon: string;
  intensity: number;
  phase: string;
  countdown: number;
  counter: string;
  warning: string;
  color: string;
}

export interface HudSnapshot {
  altitude: number;
  maxAltitude: number;
  best: number;
  climbRate: number;
  nextMilestone: number;
  zoneIndex: number;
  fuel: number;
  maxFuel: number;
  envelope: number;
  maxEnvelope: number;
  basket: number;
  maxBasket: number;
  oxygen: number;
  maxOxygen: number;
  needsO2: boolean;
  temp: number;
  ambient: number;
  wind: number;
  ice: number;
  equipment: number;
  heat: number;
  repairing: number;
  materials: number;
  repairCost: number;
  tools: { id: ToolId; charges: number }[];
  currentTool: ToolId | null;
  rod: number;
  shield: number;
  warnings: HudWarning[];
  recordBroken: boolean;
  coins: number;
  time: number;
  noFuel: boolean;
  hypoxic: boolean;
  burning: boolean;
  venting: boolean;
  pacing: string;
  dying: boolean;
}

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'warn' | 'danger' | 'good' | 'gold';
  big?: boolean;
  sub?: string;
}

export interface FlightConfig {
  mode: 'normal' | 'daily' | 'challenge';
  challengeId?: string;
  seed: number;
  mods: Partial<FlightModifiers>;
  target?: number;
  label: string;
}

export interface EngineApi {
  startFlight(cfg: FlightConfig): void;
  abandonFlight(): void;
  setPaused(p: boolean): void;
  showcase(kind: 'menu' | 'character' | 'garage'): void;
  refreshShowcase(): void;
  applySettings(): void;
}

let engine: EngineApi | null = null;
export const registerEngine = (e: EngineApi) => {
  engine = e;
};
export const getEngine = () => engine;

let toastId = 1;

export function isCharacterUnlocked(save: SaveData, c: CharacterDef) {
  if (!c.unlock) return true;
  return save.level >= (c.unlock.level ?? Infinity) || save.stats.bestAltitude >= (c.unlock.altitude ?? Infinity);
}

export function lookFor(save: SaveData, c: CharacterDef) {
  const cust = save.customization[c.id] ?? {};
  return { shirt: cust.shirt ?? c.shirt, pants: cust.pants ?? c.pants, accessory: cust.accessory ?? c.defaultAccessory };
}

interface GameState {
  screen: Screen;
  save: SaveData;
  hud: HudSnapshot | null;
  toasts: Toast[];
  paused: boolean;
  equipmentOpen: boolean;
  flight: FlightConfig | null;
  lastResult: RunResult | null;
  flowStep: number;
  setScreen(s: Screen): void;
  update(fn: (s: SaveData) => void): void;
  toast(t: Omit<Toast, 'id'>, ms?: number): void;
  buyUpgrade(id: string): boolean;
  buyBalloon(id: string): boolean;
  selectBalloon(id: string): void;
  selectCharacter(id: string): void;
  customize(charId: string, c: Customization): void;
  buyAccessory(id: string): boolean;
  setSettings(s: Partial<Settings>): void;
  resetProgress(): void;
  prepareFlight(cfg?: Partial<FlightConfig>): void;
  launch(): void;
  setHud(h: HudSnapshot): void;
  setPaused(p: boolean): void;
  setEquipmentOpen(o: boolean): void;
  recordAltitude(alt: number): void;
  finishFlight(sim: FlightSim): void;
  quitFlight(): void;
}

export const useGame = create<GameState>((set, get) => ({
  screen: 'menu',
  save: loadSave(),
  hud: null,
  toasts: [],
  paused: false,
  equipmentOpen: false,
  flight: null,
  lastResult: null,
  flowStep: 0,

  setScreen(screen) {
    set({ screen });
    const e = getEngine();
    if (!e) return;
    if (screen === 'character') e.showcase('character');
    else if (screen === 'garage') e.showcase('garage');
    else if (screen !== 'flight' && screen !== 'results') e.showcase('menu');
  },

  update(fn) {
    const save = structuredClone(get().save);
    fn(save);
    writeSave(save);
    set({ save });
  },

  toast(t, ms = 2600) {
    const toast = { ...t, id: toastId++ };
    set({ toasts: [...get().toasts.slice(-5), toast] });
    setTimeout(() => set({ toasts: get().toasts.filter((x) => x.id !== toast.id) }), ms);
  },

  buyUpgrade(id) {
    const def = UPGRADES.find((u) => u.id === id);
    const s = get().save;
    if (!def) return false;
    const lvl = s.upgrades[id] ?? 0;
    const cost = def.costs[lvl];
    if (cost === undefined || s.coins < cost || s.level < def.requiredLevel) return false;
    get().update((sv) => {
      sv.coins -= cost;
      sv.upgrades[id] = lvl + 1;
    });
    return true;
  },

  buyBalloon(id) {
    const b = BALLOONS.find((x) => x.id === id);
    const s = get().save;
    if (!b || s.ownedBalloons.includes(id) || s.coins < b.cost || s.level < b.level || s.shards < (b.shardCost ?? 0)) return false;
    get().update((sv) => {
      sv.coins -= b.cost;
      sv.shards -= b.shardCost ?? 0;
      sv.ownedBalloons.push(id);
      sv.selectedBalloon = id;
    });
    getEngine()?.refreshShowcase();
    return true;
  },

  selectBalloon(id) {
    if (!get().save.ownedBalloons.includes(id)) return;
    get().update((sv) => (sv.selectedBalloon = id));
    getEngine()?.refreshShowcase();
  },

  selectCharacter(id) {
    const c = CHARACTERS.find((x) => x.id === id);
    if (!c || !isCharacterUnlocked(get().save, c)) return;
    get().update((sv) => (sv.selectedCharacter = id));
    getEngine()?.refreshShowcase();
  },

  customize(charId, c) {
    get().update((sv) => (sv.customization[charId] = { ...(sv.customization[charId] ?? {}), ...c }));
    getEngine()?.refreshShowcase();
  },

  buyAccessory(id) {
    const a = ACCESSORIES.find((x) => x.id === id);
    const s = get().save;
    if (!a?.shardCost || s.ownedAccessories.includes(id) || s.shards < a.shardCost || s.level < a.level) return false;
    get().update((sv) => {
      sv.shards -= a.shardCost!;
      sv.ownedAccessories.push(id);
    });
    return true;
  },

  setSettings(p) {
    get().update((sv) => (sv.settings = { ...sv.settings, ...p }));
    getEngine()?.applySettings();
  },

  resetProgress() {
    const settings = get().save.settings;
    const fresh = defaultSave();
    fresh.settings = settings;
    writeSave(fresh);
    set({ save: fresh });
    getEngine()?.refreshShowcase();
  },

  prepareFlight(cfg) {
    const seed = cfg?.seed ?? (Math.floor(Math.random() * 2 ** 31) >>> 0);
    set({ flight: { mode: 'normal', mods: {}, label: 'Free Flight', ...cfg, seed }, screen: 'prep' });
    getEngine()?.showcase('menu');
  },

  launch() {
    const f = get().flight ?? { mode: 'normal' as const, mods: {}, seed: Math.floor(Math.random() * 2 ** 31), label: 'Free Flight' };
    set({ flight: f, screen: 'flight', paused: false, equipmentOpen: false, hud: null, lastResult: null });
    getEngine()?.startFlight(f);
    get().update((sv) => (sv.hasPicked = true));
  },

  setHud(hud) {
    set({ hud });
  },

  setPaused(p) {
    set({ paused: p });
    getEngine()?.setPaused(p || get().equipmentOpen);
  },

  setEquipmentOpen(o) {
    set({ equipmentOpen: o });
    getEngine()?.setPaused(o || get().paused);
  },

  recordAltitude(alt) {
    get().update((sv) => {
      if (alt > sv.stats.bestAltitude) sv.stats.bestAltitude = Math.round(alt);
    });
  },

  quitFlight() {
    getEngine()?.abandonFlight();
  },

  finishFlight(sim) {
    const s = get().save;
    const flight = get().flight;
    const rewards = computeRewards(sim);
    const prevBest = sim.previousBest;
    const newRecord = sim.maxAltitude > prevBest && prevBest > 0;
    const unlockedAch: string[] = [];
    const doneMissions: string[] = [];
    const levelBefore = s.level;
    let extraCoins = 0;
    let extraShards = 0;
    const lines = [...rewards.lines];

    const next = structuredClone(s);
    const st = next.stats;
    st.flights++;
    st.bestAltitude = Math.max(st.bestAltitude, Math.round(sim.maxAltitude));
    st.totalAltitude += Math.round(sim.maxAltitude);
    st.totalTime += sim.time;
    st.disastersSurvived += sim.disastersSurvived;
    for (const [k, v] of Object.entries(sim.disasterCounts)) st.disasterCounts[k as keyof typeof st.disasterCounts] = (st.disasterCounts[k as keyof typeof st.disasterCounts] ?? 0) + (v ?? 0);
    st.nearMisses += sim.nearMisses;
    st.repairs += sim.repairs;
    if (sim.endReason === 'landing') st.landings++;
    if (sim.endReason === 'crash' || sim.endReason === 'envelope' || sim.endReason === 'basket') st.crashes++;
    st.shardsFound += sim.shards;
    st.relicsFound += sim.relics;
    st.highestZone = Math.max(st.highestZone, sim.highestZone + 1);
    st.longestFlight = Math.max(st.longestFlight, sim.time);
    st.lightningAbsorbed += sim.lightningAbsorbed;
    st.hits += sim.hits;
    st.toolsUsed += sim.toolsUsed;

    const result: RunResult = {
      seed: sim.seed, characterId: sim.loadout.character.id, balloonId: sim.loadout.balloon.id, difficulty: sim.loadout.difficulty,
      maxAltitude: sim.maxAltitude, duration: sim.time, coinsCollected: Math.round(sim.coinsCollected), coinsEarned: 0, xpEarned: rewards.xp,
      shards: sim.shards, relics: sim.relics, disastersSurvived: sim.disastersSurvived, disasterCounts: sim.disasterCounts,
      maxIntensity: sim.maxIntensity, nearMisses: sim.nearMisses, hits: sim.hits, repairs: sim.repairs, toolsUsed: sim.toolsUsed,
      lightningAbsorbed: sim.lightningAbsorbed, endReason: sim.endReason ?? 'abandoned', newRecord, previousBest: prevBest,
      zoneReached: sim.highestZone, breakdown: [], challengeId: flight?.challengeId, daily: flight?.mode === 'daily' ? dailyChallenge(new Date()).key : undefined,
      completedMissions: [], unlockedAchievements: [], levelBefore, levelAfter: levelBefore,
    };

    for (const m of MISSIONS) {
      if (!next.missions.includes(m.id) && m.check(result)) {
        next.missions.push(m.id);
        doneMissions.push(m.id);
        extraCoins += m.reward;
        lines.push({ label: `Mission: ${m.name}`, coins: m.reward });
      }
    }
    if (flight?.mode === 'challenge' && flight.challengeId) {
      const c = CHALLENGE_FLIGHTS.find((x) => x.id === flight.challengeId);
      if (c && sim.maxAltitude >= c.target && !next.challenges.includes(c.id)) {
        next.challenges.push(c.id);
        extraCoins += c.reward;
        extraShards += c.shardReward;
        lines.push({ label: `Challenge complete: ${c.name}`, coins: c.reward });
      }
    }
    if (flight?.mode === 'daily') {
      const d = dailyChallenge(new Date());
      if (sim.maxAltitude >= d.target && next.dailyDone !== d.key) {
        next.dailyDone = d.key;
        st.dailiesCompleted++;
        extraCoins += d.reward;
        extraShards += d.shardReward;
        lines.push({ label: 'Daily challenge complete!', coins: d.reward });
      }
    }
    const coinsEarned = rewards.coins + extraCoins;
    st.totalCoins += coinsEarned;
    for (const a of ACHIEVEMENTS) {
      if (!next.achievements.includes(a.id) && a.check(st, result)) {
        next.achievements.push(a.id);
        unlockedAch.push(a.id);
        lines.push({ label: `Achievement: ${a.name}`, coins: a.reward });
        st.totalCoins += a.reward;
        next.coins += a.reward;
      }
    }
    next.coins += coinsEarned;
    next.shards += sim.shards + extraShards;
    const lv = applyXp(next.level, next.xp, rewards.xp);
    next.level = lv.level;
    next.xp = lv.xp;

    result.coinsEarned = lines.reduce((a, l) => a + l.coins, 0);
    result.breakdown = lines;
    result.completedMissions = doneMissions;
    result.unlockedAchievements = unlockedAch;
    result.levelAfter = lv.level;
    writeSave(next);
    set({ save: next, lastResult: result, screen: 'results', paused: false, equipmentOpen: false });
  },
}));

export function newSeedFor(label: string) {
  return hashString(label + Date.now());
}

export function currentLoadout(save: SaveData, mods: Partial<FlightModifiers> = {}) {
  return buildLoadout({
    characterId: save.selectedCharacter,
    balloonId: save.selectedBalloon,
    upgrades: save.upgrades,
    difficulty: save.settings.difficulty,
    flight: mods,
    playerLevel: save.level,
  });
}
