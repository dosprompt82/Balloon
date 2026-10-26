import type { DisasterId } from '../../data/disasters';
import type { Difficulty } from '../../data/config';

export type EndReason = 'envelope' | 'basket' | 'crash' | 'landing' | 'fuel' | 'abandoned';

export interface RunResult {
  seed: number;
  characterId: string;
  balloonId: string;
  difficulty: Difficulty;
  maxAltitude: number;
  duration: number;
  coinsCollected: number;
  coinsEarned: number;
  xpEarned: number;
  shards: number;
  relics: number;
  disastersSurvived: number;
  disasterCounts: Partial<Record<DisasterId, number>>;
  maxIntensity: number;
  nearMisses: number;
  hits: number;
  repairs: number;
  toolsUsed: number;
  lightningAbsorbed: number;
  endReason: EndReason;
  newRecord: boolean;
  previousBest: number;
  zoneReached: number;
  breakdown: { label: string; coins: number }[];
  challengeId?: string;
  daily?: string;
  completedMissions: string[];
  unlockedAchievements: string[];
  levelBefore: number;
  levelAfter: number;
}

export interface Stats {
  flights: number;
  bestAltitude: number;
  totalAltitude: number;
  totalTime: number;
  totalCoins: number;
  disastersSurvived: number;
  disasterCounts: Partial<Record<DisasterId, number>>;
  nearMisses: number;
  repairs: number;
  landings: number;
  crashes: number;
  shardsFound: number;
  relicsFound: number;
  highestZone: number;
  longestFlight: number;
  lightningAbsorbed: number;
  hits: number;
  toolsUsed: number;
  dailiesCompleted: number;
}

export interface FlightModifiers {
  fuel: number;
  damage: number;
  disasterRate: number;
  intensity: number;
  coins: number;
  noFans: boolean;
  startAltitude: number;
}

export const DEFAULT_FLIGHT_MODS: FlightModifiers = {
  fuel: 1,
  damage: 1,
  disasterRate: 1,
  intensity: 1,
  coins: 1,
  noFans: false,
  startAltitude: 0,
};
