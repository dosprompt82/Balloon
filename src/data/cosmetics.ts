export interface AccessoryDef {
  id: string;
  name: string;
  level: number;
  shardCost?: number;
}

export const ACCESSORIES: AccessoryDef[] = [
  { id: 'none', name: 'None', level: 1 },
  { id: 'scarf', name: 'Flight Scarf', level: 1 },
  { id: 'headphones', name: 'Headphones', level: 1 },
  { id: 'goggles', name: 'Workshop Goggles', level: 1 },
  { id: 'beanie', name: 'Cozy Beanie', level: 1 },
  { id: 'shades', name: 'Cool Shades', level: 1 },
  { id: 'aviator', name: 'Aviator Cap', level: 1 },
  { id: 'glasses', name: 'Lab Glasses', level: 1 },
  { id: 'captainHat', name: 'Captain Hat', level: 8 },
  { id: 'topHat', name: 'Top Hat', level: 3 },
  { id: 'flowerCrown', name: 'Flower Crown', level: 5 },
  { id: 'propeller', name: 'Propeller Cap', level: 7 },
  { id: 'crown', name: 'Sky Crown', level: 12, shardCost: 15 },
  { id: 'halo', name: 'Celestial Halo', level: 16, shardCost: 30 },
];

export const OUTFIT_COLORS: { color: string; level: number }[] = [
  { color: '#e8553d', level: 1 }, { color: '#3fa7d6', level: 1 }, { color: '#f2a541', level: 1 }, { color: '#7b5ea7', level: 1 },
  { color: '#4f772d', level: 1 }, { color: '#1b1b1e', level: 1 }, { color: '#f4f1de', level: 1 }, { color: '#1d3557', level: 1 },
  { color: '#ff70a6', level: 2 }, { color: '#00bbf9', level: 3 }, { color: '#fee440', level: 4 }, { color: '#00f5d4', level: 5 },
  { color: '#9b5de5', level: 6 }, { color: '#f15bb5', level: 8 }, { color: '#c0c0c0', level: 10 }, { color: '#ffd700', level: 14 },
];
