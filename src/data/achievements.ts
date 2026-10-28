import type { RunResult, Stats } from '../game/core/types';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  reward: number;
  check: (s: Stats, run?: RunResult) => boolean;
}

const alt = (m: number) => (s: Stats) => s.bestAltitude >= m;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'firstFlight', name: 'Up, Up and Away', description: 'Complete your first flight.', icon: '🎈', reward: 25, check: (s) => s.flights >= 1 },
  { id: 'alt1k', name: 'Cloud Toucher', description: 'Reach 1,000 m.', icon: '☁', reward: 30, check: alt(1000) },
  { id: 'alt3k', name: 'Storm Watcher', description: 'Reach Thunder Alley (3,000 m).', icon: '⛈', reward: 60, check: alt(3000) },
  { id: 'alt6k', name: 'Twister Bound', description: 'Reach Tornado Territory (6,000 m).', icon: '🌪', reward: 100, check: alt(6000) },
  { id: 'alt10k', name: 'Ice Breaker', description: 'Reach the Frozen Heights (10,000 m).', icon: '❄', reward: 160, check: alt(10000) },
  { id: 'alt15k', name: 'Breathless', description: 'Reach the Thin Air (15,000 m).', icon: '🫧', reward: 220, check: alt(15000) },
  { id: 'alt22k', name: 'Curvature', description: 'See the curve of the world (22,000 m).', icon: '🌍', reward: 300, check: alt(22000) },
  { id: 'alt35k', name: 'Stargazer', description: 'Reach the Edge of Space (35,000 m).', icon: '✨', reward: 450, check: alt(35000) },
  { id: 'alt60k', name: 'Chaos Pilot', description: 'Enter Celestial Chaos (60,000 m).', icon: '☄', reward: 700, check: alt(60000) },
  { id: 'alt100k', name: 'Into the Infinite', description: 'Pass 100,000 m.', icon: '♾', reward: 1200, check: alt(100000) },
  { id: 'alt150k', name: 'Beyond Legend', description: 'Pass 150,000 m.', icon: '👑', reward: 2000, check: alt(150000) },
  { id: 'survivor10', name: 'Weather-Beaten', description: 'Survive 10 disasters.', icon: '🛡', reward: 120, check: (s) => s.disastersSurvived >= 10 },
  { id: 'survivor50', name: 'Storm Veteran', description: 'Survive 50 disasters.', icon: '🏅', reward: 400, check: (s) => s.disastersSurvived >= 50 },
  { id: 'tornado', name: 'Eye of the Storm', description: 'Survive a tornado.', icon: '🌀', reward: 100, check: (s) => (s.disasterCounts.tornado ?? 0) >= 1 },
  { id: 'supercell', name: 'Lightning Dancer', description: 'Survive a Lightning Supercell.', icon: '⚡', reward: 200, check: (s) => (s.disasterCounts.supercell ?? 0) >= 1 },
  { id: 'meteor', name: 'Shooting Star', description: 'Survive a meteor shower.', icon: '☄', reward: 250, check: (s) => (s.disasterCounts.meteorShower ?? 0) >= 1 },
  { id: 'allDisasters', name: 'Disaster Encyclopedia', description: 'Survive all 12 disaster types.', icon: '📖', reward: 1500, check: (s) => Object.values(s.disasterCounts).filter((v) => (v ?? 0) > 0).length >= 12 },
  { id: 'nearMiss25', name: 'Close Shave', description: 'Make 25 near misses.', icon: '😅', reward: 120, check: (s) => s.nearMisses >= 25 },
  { id: 'rod', name: 'Grounded', description: 'Absorb 10 lightning strikes with the rod.', icon: '🔱', reward: 150, check: (s) => s.lightningAbsorbed >= 10 },
  { id: 'landing', name: 'Feather Touch', description: 'Make a safe landing.', icon: '🪶', reward: 80, check: (s) => s.landings >= 1 },
  { id: 'mechanic', name: 'Duct Tape Hero', description: 'Make 25 repairs.', icon: '🔧', reward: 120, check: (s) => s.repairs >= 25 },
  { id: 'shard', name: 'Star Collector', description: 'Find 10 star shards.', icon: '💎', reward: 150, check: (s) => s.shardsFound >= 10 },
  { id: 'relic', name: 'Relic Hunter', description: 'Find a legendary sky relic.', icon: '🗿', reward: 500, check: (s) => s.relicsFound >= 1 },
  { id: 'flights25', name: 'Frequent Flyer', description: 'Complete 25 flights.', icon: '🎫', reward: 200, check: (s) => s.flights >= 25 },
  { id: 'untouched', name: 'Untouchable', description: 'Reach 3,000 m without taking a hit.', icon: '🕊', reward: 150, check: (_s, r) => !!r && r.hits === 0 && r.maxAltitude >= 3000 },
  { id: 'rich', name: 'Sky Tycoon', description: 'Earn 10,000 coins in total.', icon: '💰', reward: 300, check: (s) => s.totalCoins >= 10000 },
];
