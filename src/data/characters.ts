import type { Modifiers } from './modifiers';

export type HairStyle = 'messy' | 'ponytail' | 'buzz' | 'bob' | 'mohawk' | 'curls' | 'bun' | 'captain';

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  ability: string;
  abilityDetail: string;
  modifiers: Partial<Modifiers>;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  pants: string;
  accent: string;
  build: 'normal' | 'tall' | 'short' | 'broad';
  defaultAccessory: string;
  unlock?: { level?: number; altitude?: number; text: string };
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'alex', name: 'Alex', title: 'The Adventurer', ability: 'Nimble Pilot',
    abilityDetail: '+20% lateral steering responsiveness.',
    modifiers: { steer: 1.2 },
    skin: '#f1c27d', hair: '#6b3e1f', hairStyle: 'messy', shirt: '#e8553d', pants: '#36506e', accent: '#ffd166', build: 'normal', defaultAccessory: 'scarf',
  },
  {
    id: 'maya', name: 'Maya', title: 'The Meteorologist', ability: 'Storm Sense',
    abilityDetail: 'Disaster warnings arrive 60% earlier.',
    modifiers: { warningTime: 1.6 },
    skin: '#c68642', hair: '#1f1a17', hairStyle: 'ponytail', shirt: '#3fa7d6', pants: '#2b3a55', accent: '#f6f7eb', build: 'normal', defaultAccessory: 'headphones',
  },
  {
    id: 'finn', name: 'Finn', title: 'The Mechanic', ability: 'Patch Master',
    abilityDetail: 'Repairs use half the materials.',
    modifiers: { repairCost: 0.5 },
    skin: '#e0ac69', hair: '#d97b29', hairStyle: 'buzz', shirt: '#f2a541', pants: '#4a4e69', accent: '#3d405b', build: 'broad', defaultAccessory: 'goggles',
  },
  {
    id: 'luna', name: 'Luna', title: 'The Explorer', ability: 'Treasure Nose',
    abilityDetail: 'Rare collectibles appear 75% more often.',
    modifiers: { rareChance: 1.75 },
    skin: '#ffdbac', hair: '#b8b8ff', hairStyle: 'bob', shirt: '#7b5ea7', pants: '#2e294e', accent: '#9ef0c9', build: 'short', defaultAccessory: 'beanie',
  },
  {
    id: 'rex', name: 'Rex', title: 'The Daredevil', ability: 'Thrill Seeker',
    abilityDetail: 'Near misses pay triple coins.',
    modifiers: { nearMissReward: 3 },
    skin: '#8d5524', hair: '#ff3864', hairStyle: 'mohawk', shirt: '#1b1b1e', pants: '#d7263d', accent: '#f9c80e', build: 'tall', defaultAccessory: 'shades',
  },
  {
    id: 'piper', name: 'Piper', title: 'The Pilot', ability: 'Fuel Whisperer',
    abilityDetail: 'Burner uses 25% less fuel.',
    modifiers: { fuelUse: 0.75 },
    skin: '#f1c27d', hair: '#e9d985', hairStyle: 'bun', shirt: '#4f772d', pants: '#90a955', accent: '#ecf39e', build: 'normal', defaultAccessory: 'aviator',
  },
  {
    id: 'nova', name: 'Nova', title: 'The Scientist', ability: 'Altitude Adapted',
    abilityDetail: '40% less oxygen use and +12° cold resistance.',
    modifiers: { oxygenUse: 0.6, coldResist: 12 },
    skin: '#a0673f', hair: '#f4f1de', hairStyle: 'curls', shirt: '#f4f1de', pants: '#5e60ce', accent: '#64dfdf', build: 'short', defaultAccessory: 'glasses',
  },
  {
    id: 'captain', name: 'Captain Cloud', title: 'The Veteran', ability: 'Seasoned Aeronaut',
    abilityDetail: '+10% steering, fuel, oxygen and armour, +6° cold resistance.',
    modifiers: { steer: 1.1, fuelUse: 0.9, oxygenUse: 0.9, damageTaken: 0.9, coldResist: 6, warningTime: 1.1 },
    skin: '#e8beac', hair: '#eeeeee', hairStyle: 'captain', shirt: '#1d3557', pants: '#457b9d', accent: '#e9c46a', build: 'broad', defaultAccessory: 'captainHat',
    unlock: { level: 8, altitude: 22000, text: 'Reach player level 8 or 22,000 m' },
  },
];

export const characterById = (id: string) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
