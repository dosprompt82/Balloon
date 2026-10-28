import { DIFFICULTY, ECONOMY } from '../../data/config';
import type { FlightSim } from '../simulation';

export interface RewardBreakdown {
  lines: { label: string; coins: number }[];
  coins: number;
  xp: number;
}

export function computeRewards(sim: FlightSim): RewardBreakdown {
  const L = sim.loadout;
  const diff = DIFFICULTY[L.difficulty].reward;
  const km = Math.max(0, sim.maxAltitude - L.flight.startAltitude) / 1000;
  const lines: { label: string; coins: number }[] = [];
  const add = (label: string, coins: number) => {
    const c = Math.round(coins);
    if (c > 0) lines.push({ label, coins: c });
  };
  // altitude pay grows slightly per km so deep runs feel lucrative
  add('Altitude reached', ECONOMY.coinsPerKm * km * (1 + km / 60) * L.mods.coinGain);
  add('Coins collected', sim.coinsCollected);
  add('Disasters survived', sim.disasterCoins);
  add('Milestones', sim.milestoneCoins);
  add('Near misses', sim.nearMissCoins);
  add('Lightning absorbed', sim.absorbCoins);
  if (sim.recordBroken) add('New personal best!', ECONOMY.recordBonus + km * 4);
  let subtotal = lines.reduce((s, l) => s + l.coins, 0);
  if (sim.endReason === 'landing') {
    const bonus = subtotal * ECONOMY.safeLandingBonus;
    add('Safe landing bonus (+25%)', bonus);
    subtotal += Math.round(bonus);
  }
  const mult = diff * L.flight.coins;
  if (mult !== 1) {
    const delta = subtotal * (mult - 1);
    lines.push({ label: `Difficulty & challenge ×${mult.toFixed(2)}`, coins: Math.round(delta) });
    subtotal += Math.round(delta);
  }
  const xp = Math.round(10 + ECONOMY.xpPerKm * km + ECONOMY.xpPerDisaster * sim.disastersSurvived + sim.nearMisses * 2);
  return { lines, coins: Math.max(0, subtotal), xp };
}

/** Total XP required to go from level n to n+1. */
export const xpToNext = (level: number) => Math.round(ECONOMY.levelXpBase * ECONOMY.levelXpGrowth ** (level - 1));

export function applyXp(level: number, xp: number, gained: number): { level: number; xp: number; levelsGained: number } {
  let l = level;
  let x = xp + gained;
  let g = 0;
  while (x >= xpToNext(l)) {
    x -= xpToNext(l);
    l++;
    g++;
  }
  return { level: l, xp: x, levelsGained: g };
}
