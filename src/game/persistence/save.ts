import type { Stats } from '../core/types';
import type { Difficulty } from '../../data/config';

export type Action = 'burner' | 'vent' | 'left' | 'right' | 'boost' | 'tool' | 'repair' | 'switchTool' | 'equipment' | 'pause';

export const DEFAULT_BINDINGS: Record<Action, string[]> = {
  burner: ['KeyW', 'ArrowUp'],
  vent: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  boost: ['ShiftLeft', 'ShiftRight'],
  tool: ['Space'],
  repair: ['KeyE'],
  switchTool: ['KeyQ'],
  equipment: ['Tab'],
  pause: ['Escape', 'KeyP'],
};

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  quality: 'low' | 'medium' | 'high';
  shake: number;
  controlMode: 'keyboard' | 'mouse';
  difficulty: Difficulty;
  bindings: Record<Action, string[]>;
  showHints: boolean;
}

export interface Customization {
  shirt?: string;
  pants?: string;
  accessory?: string;
}

export interface SaveData {
  version: 1;
  coins: number;
  shards: number;
  level: number;
  xp: number;
  selectedCharacter: string;
  selectedBalloon: string;
  ownedBalloons: string[];
  ownedAccessories: string[];
  upgrades: Record<string, number>;
  customization: Record<string, Customization>;
  stats: Stats;
  achievements: string[];
  missions: string[];
  challenges: string[];
  dailyDone: string;
  settings: Settings;
  hasPicked: boolean;
  tutorialDone: boolean;
}

export const defaultStats = (): Stats => ({
  flights: 0, bestAltitude: 0, totalAltitude: 0, totalTime: 0, totalCoins: 0, disastersSurvived: 0,
  disasterCounts: {}, nearMisses: 0, repairs: 0, landings: 0, crashes: 0, shardsFound: 0, relicsFound: 0,
  highestZone: 0, longestFlight: 0, lightningAbsorbed: 0, hits: 0, toolsUsed: 0, dailiesCompleted: 0,
});

export const defaultSettings = (): Settings => ({
  master: 0.8, music: 0.5, sfx: 0.8, quality: 'high', shake: 0.6, controlMode: 'keyboard', difficulty: 'normal',
  bindings: structuredClone(DEFAULT_BINDINGS), showHints: true,
});

export const defaultSave = (): SaveData => ({
  version: 1, coins: 0, shards: 0, level: 1, xp: 0, selectedCharacter: 'alex', selectedBalloon: 'sunny',
  ownedBalloons: ['sunny'], ownedAccessories: [], upgrades: { ballast: 1 }, customization: {}, stats: defaultStats(),
  achievements: [], missions: [], challenges: [], dailyDone: '', settings: defaultSettings(), hasPicked: false, tutorialDone: false,
});

const KEY = 'skybound-save-v1';

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const storage = (): KV | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

/** Merge a possibly old/partial save over defaults so new fields always exist. */
export function migrate(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<SaveData>;
  return {
    ...d,
    ...r,
    version: 1,
    stats: { ...d.stats, ...(r.stats ?? {}) },
    settings: { ...d.settings, ...(r.settings ?? {}), bindings: { ...d.settings.bindings, ...(r.settings?.bindings ?? {}) } },
    upgrades: { ...d.upgrades, ...(r.upgrades ?? {}) },
    ownedBalloons: Array.from(new Set(['sunny', ...(r.ownedBalloons ?? [])])),
  };
}

export function loadSave(kv: KV | null = storage()): SaveData {
  try {
    const s = kv?.getItem(KEY);
    return migrate(s ? JSON.parse(s) : null);
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData, kv: KV | null = storage()) {
  try {
    kv?.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full or unavailable — the game keeps running */
  }
}

export function resetSave(kv: KV | null = storage()) {
  writeSave(defaultSave(), kv);
}
