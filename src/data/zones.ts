export interface ZoneDef {
  id: number;
  name: string;
  min: number;
  max: number;
  /** Sky palette (zenith/horizon) at midday, before storms and time-of-day tinting. */
  zenith: string;
  horizon: string;
  cloudTint: string;
  windStrength: number;
  turbulence: number;
  description: string;
  mechanic: string;
}

export const ZONES: ZoneDef[] = [
  { id: 1, name: 'Peaceful Skies', min: 0, max: 1000, zenith: '#3f8fe6', horizon: '#bfe6ff', cloudTint: '#ffffff', windStrength: 3, turbulence: 0.1, description: 'Green hills, gentle clouds and curious birds.', mechanic: 'Burner, vent and momentum' },
  { id: 2, name: 'Cloud Country', min: 1000, max: 3000, zenith: '#3a7fd8', horizon: '#d6efff', cloudTint: '#f7fbff', windStrength: 6, turbulence: 0.2, description: 'Towering cumulus castles and shifting wind layers.', mechanic: 'Wind-layer navigation' },
  { id: 3, name: 'Thunder Alley', min: 3000, max: 6000, zenith: '#33589a', horizon: '#9fb6d6', cloudTint: '#c9d3e6', windStrength: 8, turbulence: 0.45, description: 'Dark thunderheads crackling with charge.', mechanic: 'Lightning warnings and grounding' },
  { id: 4, name: 'Tornado Territory', min: 6000, max: 10000, zenith: '#45608a', horizon: '#c7c0a8', cloudTint: '#cfc8b8', windStrength: 11, turbulence: 0.6, description: 'Colossal funnels and spinning debris.', mechanic: 'Escaping rotating wind fields' },
  { id: 5, name: 'The Frozen Heights', min: 10000, max: 15000, zenith: '#2f6fb8', horizon: '#d9f3ff', cloudTint: '#e9fbff', windStrength: 10, turbulence: 0.35, description: 'Glittering ice crystals in a cold blue void.', mechanic: 'Thermal management' },
  { id: 6, name: 'The Thin Air', min: 15000, max: 22000, zenith: '#22408a', horizon: '#8fb4e0', cloudTint: '#dde8ff', windStrength: 12, turbulence: 0.3, description: 'The sky darkens and every breath counts.', mechanic: 'Oxygen and high-altitude tech' },
  { id: 7, name: 'Stratosphere Frontier', min: 22000, max: 35000, zenith: '#1a2466', horizon: '#6d8fd0', cloudTint: '#d2d8ff', windStrength: 13, turbulence: 0.35, description: 'The curve of the world appears below.', mechanic: 'Specialised high-altitude upgrades' },
  { id: 8, name: 'Edge of Space', min: 35000, max: 60000, zenith: '#0d0b2e', horizon: '#4a3f8f', cloudTint: '#b9a8ff', windStrength: 12, turbulence: 0.4, description: 'Stars by day. A blue planet hangs beneath you.', mechanic: 'Experimental propulsion' },
  { id: 9, name: 'Celestial Chaos', min: 60000, max: 100000, zenith: '#100524', horizon: '#6a2c8f', cloudTint: '#e0a8ff', windStrength: 14, turbulence: 0.55, description: 'A fantastical realm of meteors and energy.', mechanic: 'Energy shields and navigation' },
  { id: 10, name: 'The Infinite Above', min: 100000, max: Infinity, zenith: '#06021a', horizon: '#2b6f7f', cloudTint: '#9ffff0', windStrength: 15, turbulence: 0.6, description: 'Endless, surreal and beautiful. How far can you go?', mechanic: 'Escalating legendary challenges' },
];

export function zoneIndexAt(altitude: number): number {
  for (let i = ZONES.length - 1; i >= 0; i--) if (altitude >= ZONES[i].min) return i;
  return 0;
}
export const zoneAt = (altitude: number) => ZONES[zoneIndexAt(altitude)];
