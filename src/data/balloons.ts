import type { Modifiers } from './modifiers';

export type PatternType = 'stripes' | 'sunburst' | 'patchwork' | 'zigzag' | 'stars' | 'checker' | 'gradient' | 'spiral' | 'hyper' | 'insano';

export interface BalloonDef {
  id: string;
  name: string;
  description: string;
  pattern: PatternType;
  colors: string[];
  envelopeHp: number;
  basketHp: number;
  fuelCapacity: number;
  modifiers: Partial<Modifiers>;
  cost: number;
  shardCost?: number;
  level: number;
  scale: number;
}

export const BALLOONS: BalloonDef[] = [
  { id: 'sunny', name: 'Sunny Days', description: 'A cheerful classic. Reliable in every weather.', pattern: 'stripes', colors: ['#ff6b4a', '#ffd166', '#ff6b4a', '#06d6a0'], envelopeHp: 100, basketHp: 100, fuelCapacity: 100, modifiers: {}, cost: 0, level: 1, scale: 1 },
  { id: 'patch', name: 'Patchwork Pal', description: 'Stitched from a hundred scraps. Cheap to repair.', pattern: 'patchwork', colors: ['#e76f51', '#f4a261', '#2a9d8f', '#e9c46a', '#8ab17d', '#b56576'], envelopeHp: 110, basketHp: 100, fuelCapacity: 95, modifiers: { repairCost: 0.8 }, cost: 600, level: 2, scale: 1 },
  { id: 'zephyr', name: 'Zephyr Racer', description: 'Slim and agile. Steers beautifully, burns hungry.', pattern: 'zigzag', colors: ['#118ab2', '#ffffff', '#ef476f'], envelopeHp: 90, basketHp: 90, fuelCapacity: 100, modifiers: { steer: 1.35, fuelUse: 1.1 }, cost: 1400, level: 4, scale: 0.92 },
  { id: 'storm', name: 'Storm Chaser', description: 'Rubberised fabric shrugs off hail and lightning.', pattern: 'checker', colors: ['#2b2d42', '#f9c80e', '#8d99ae'], envelopeHp: 140, basketHp: 125, fuelCapacity: 105, modifiers: { damageTaken: 0.85, lift: 0.95 }, cost: 2800, level: 6, scale: 1.05 },
  { id: 'aurora', name: 'Aurora Dream', description: 'Insulated silk that glows in the cold heights.', pattern: 'gradient', colors: ['#7400b8', '#5390d9', '#48bfe3', '#72efdd'], envelopeHp: 115, basketHp: 105, fuelCapacity: 115, modifiers: { coldResist: 10, oxygenUse: 0.85 }, cost: 4800, level: 9, scale: 1.02 },
  { id: 'phoenix', name: 'Phoenix Flame', description: 'A furnace-hearted envelope with tremendous lift.', pattern: 'sunburst', colors: ['#d00000', '#ffba08', '#e85d04', '#faa307'], envelopeHp: 120, basketHp: 110, fuelCapacity: 120, modifiers: { lift: 1.12, fuelUse: 1.05 }, cost: 7500, level: 12, scale: 1.08 },
  { id: 'celestial', name: 'Celestial Voyager', description: 'Star-woven fabric hums with stored energy.', pattern: 'stars', colors: ['#10002b', '#5a189a', '#e0aaff', '#ffd60a'], envelopeHp: 150, basketHp: 130, fuelCapacity: 130, modifiers: { lift: 1.08, damageTaken: 0.9, coinGain: 1.1 }, cost: 12000, shardCost: 25, level: 15, scale: 1.1 },
  { id: 'nebula', name: 'Nebula Spiral', description: 'Legendary. A hypnotic spiral of cosmic colour.', pattern: 'spiral', colors: ['#ff006e', '#8338ec', '#3a86ff', '#06d6a0'], envelopeHp: 165, basketHp: 140, fuelCapacity: 140, modifiers: { lift: 1.12, steer: 1.15, rareChance: 1.25 }, cost: 20000, shardCost: 60, level: 20, scale: 1.12 },
];

/** Secret F1 balloon: not sold in the garage, toggled at any time with F1. */
export const HYPER_BALLOON: BalloonDef = {
  id: 'hyper', name: 'HYPERION X', description: 'Rocket-boosted, neon-ringed and absurdly fast. Smashes through anything.',
  pattern: 'hyper', colors: ['#ff006e', '#fb5607', '#ffbe0b', '#06d6a0', '#3a86ff', '#8338ec'],
  envelopeHp: 300, basketHp: 250, fuelCapacity: 200, modifiers: {}, cost: 0, level: 1, scale: 1.15,
};

/** Secret F2 balloon: even faster than Hyperion X. */
export const INSANO_BALLOON: BalloonDef = {
  id: 'insano', name: 'INSANO X', description: 'Six afterburners, a molten envelope and no speed limit worth mentioning.',
  pattern: 'insano', colors: ['#120c1c', '#ff3d00', '#ffb000', '#ffe066', '#d00000'],
  envelopeHp: 400, basketHp: 320, fuelCapacity: 250, modifiers: {}, cost: 0, level: 1, scale: 1.2,
};

export const balloonById = (id: string) => BALLOONS.find((b) => b.id === id) ?? BALLOONS[0];
