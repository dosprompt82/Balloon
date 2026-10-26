import type { FlightModifiers, RunResult } from '../game/core/types';

export interface MissionDef {
  id: string;
  name: string;
  description: string;
  reward: number;
  check: (r: RunResult) => boolean;
}

/** Missions are checked after every flight and pay out once. */
export const MISSIONS: MissionDef[] = [
  { id: 'm_coins30', name: 'Pocket Change', description: 'Collect 30 coins in one flight.', reward: 60, check: (r) => r.coinsCollected >= 30 },
  { id: 'm_2k_piper', name: 'Efficient Ascent', description: 'Reach 2,000 m as Piper.', reward: 80, check: (r) => r.characterId === 'piper' && r.maxAltitude >= 2000 },
  { id: 'm_storm', name: 'Storm Rider', description: 'Survive 2 disasters in one flight.', reward: 90, check: (r) => r.disastersSurvived >= 2 },
  { id: 'm_rex', name: 'Thrill Ride', description: 'Make 6 near misses in one flight as Rex.', reward: 120, check: (r) => r.characterId === 'rex' && r.nearMisses >= 6 },
  { id: 'm_landing', name: 'Round Trip', description: 'Climb above 1,500 m and land safely.', reward: 150, check: (r) => r.endReason === 'landing' && r.maxAltitude >= 1500 },
  { id: 'm_5k', name: 'Above the Thunder', description: 'Reach 5,000 m in one flight.', reward: 140, check: (r) => r.maxAltitude >= 5000 },
  { id: 'm_finn', name: 'Pit Crew', description: 'Make 4 repairs in one flight as Finn.', reward: 110, check: (r) => r.characterId === 'finn' && r.repairs >= 4 },
  { id: 'm_luna', name: 'Shiny Things', description: 'Find 2 star shards in one flight as Luna.', reward: 160, check: (r) => r.characterId === 'luna' && r.shards >= 2 },
  { id: 'm_severe', name: 'Severe Weather', description: 'Survive a Severe (or worse) disaster.', reward: 180, check: (r) => r.maxIntensity >= 2 },
  { id: 'm_12k_nova', name: 'Cold Science', description: 'Reach 12,000 m as Nova.', reward: 220, check: (r) => r.characterId === 'nova' && r.maxAltitude >= 12000 },
  { id: 'm_flawless', name: 'Flawless', description: 'Reach 4,000 m without being hit.', reward: 220, check: (r) => r.hits === 0 && r.maxAltitude >= 4000 },
  { id: 'm_20k', name: 'High Society', description: 'Reach 20,000 m in one flight.', reward: 350, check: (r) => r.maxAltitude >= 20000 },
  { id: 'm_disasters5', name: 'Chaos Magnet', description: 'Survive 5 disasters in one flight.', reward: 400, check: (r) => r.disastersSurvived >= 5 },
  { id: 'm_40k', name: 'Starlight Express', description: 'Reach 40,000 m in one flight.', reward: 600, check: (r) => r.maxAltitude >= 40000 },
  { id: 'm_120k', name: 'Infinite Ambition', description: 'Reach 120,000 m in one flight.', reward: 1500, check: (r) => r.maxAltitude >= 120000 },
];

export interface ChallengeFlightDef {
  id: string;
  name: string;
  description: string;
  target: number;
  reward: number;
  shardReward: number;
  level: number;
  mods: Partial<FlightModifiers>;
}

/** Special flights with rule changes; reward paid the first time the target is reached. */
export const CHALLENGE_FLIGHTS: ChallengeFlightDef[] = [
  { id: 'c_fuel', name: 'Running on Fumes', description: 'Half fuel. Grab every canister you can.', target: 3000, reward: 300, shardReward: 2, level: 1, mods: { fuel: 0.5 } },
  { id: 'c_gauntlet', name: 'Storm Gauntlet', description: 'Disasters arrive twice as often.', target: 6000, reward: 500, shardReward: 3, level: 3, mods: { disasterRate: 2 } },
  { id: 'c_drifter', name: 'Wind Drifter', description: 'No steering fans — ride the wind layers only.', target: 4000, reward: 450, shardReward: 3, level: 2, mods: { noFans: true } },
  { id: 'c_glass', name: 'Paper Lantern', description: 'Take double damage, earn double coins.', target: 5000, reward: 500, shardReward: 3, level: 4, mods: { damage: 2, coins: 2 } },
  { id: 'c_highstart', name: 'Express Elevator', description: 'Start at 10,000 m with fiercer weather.', target: 25000, reward: 900, shardReward: 5, level: 6, mods: { startAltitude: 10000, intensity: 1.25 } },
  { id: 'c_space', name: 'Celestial Sprint', description: 'Start at 40,000 m. Survive the meteors.', target: 80000, reward: 1500, shardReward: 8, level: 10, mods: { startAltitude: 40000, intensity: 1.15 } },
];

const DAILY_MODS: { name: string; mods: Partial<FlightModifiers> }[] = [
  { name: 'Calm Morning', mods: { disasterRate: 0.7, coins: 1.2 } },
  { name: 'Wild Weather', mods: { disasterRate: 1.6, intensity: 1.15 } },
  { name: 'Lean Tanks', mods: { fuel: 0.7, coins: 1.3 } },
  { name: 'Fragile Fabric', mods: { damage: 1.5, coins: 1.5 } },
  { name: 'Free Spirit', mods: { noFans: true, coins: 1.4 } },
  { name: 'Head Start', mods: { startAltitude: 3000, intensity: 1.2 } },
];

export function dailyChallenge(date: Date) {
  const key = date.toISOString().slice(0, 10);
  let seed = 0;
  for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const variant = DAILY_MODS[seed % DAILY_MODS.length];
  const target = [3000, 4000, 5000, 6500, 8000][(seed >>> 3) % 5] + (variant.mods.startAltitude ?? 0);
  return { key, seed, name: variant.name, mods: variant.mods, target, reward: 400, shardReward: 3 };
}
