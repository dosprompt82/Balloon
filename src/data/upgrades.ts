export type UpgradeCategory = 'Flight' | 'Survival' | 'Tools' | 'Utility';

export interface UpgradeDef {
  id: string;
  name: string;
  category: UpgradeCategory;
  description: string;
  /** Short text for each level's effect (index = level - 1). */
  levels: string[];
  costs: number[];
  /** Player level needed to buy the first level. */
  requiredLevel: number;
}

const costs = (base: number, n: number, growth = 1.85) =>
  Array.from({ length: n }, (_, i) => Math.round((base * growth ** i) / 10) * 10);

export const UPGRADES: UpgradeDef[] = [
  { id: 'burner', name: 'Burner Power', category: 'Flight', description: 'Hotter flame, faster heating, faster climbs.', levels: ['+12% heat', '+24% heat', '+36% heat', '+48% heat', '+60% heat', '+75% heat'], costs: costs(120, 6), requiredLevel: 1 },
  { id: 'fuelTank', name: 'Fuel Tanks', category: 'Flight', description: 'Bigger propane tanks for longer flights.', levels: ['+20% fuel', '+40% fuel', '+60% fuel', '+85% fuel', '+110% fuel', '+140% fuel'], costs: costs(100, 6), requiredLevel: 1 },
  { id: 'fans', name: 'Steering Fans', category: 'Flight', description: 'Directional fans for lateral control. Without them you must ride the winds.', levels: ['Basic fans', 'Twin fans', 'Vectored fans', 'Turbo fans', 'Gyro fans'], costs: costs(150, 5), requiredLevel: 1 },
  { id: 'stratoEnvelope', name: 'Stratospheric Envelope', category: 'Flight', description: 'Reduces lift loss in thin air above 15,000 m.', levels: ['-25% thin-air loss', '-45%', '-65%', '-85%'], costs: costs(900, 4, 2), requiredLevel: 5 },
  { id: 'envelope', name: 'Reinforced Envelope', category: 'Survival', description: 'Tougher fabric. More balloon health.', levels: ['+20 HP', '+40 HP', '+60 HP', '+85 HP', '+110 HP', '+140 HP'], costs: costs(110, 6), requiredLevel: 1 },
  { id: 'basket', name: 'Armoured Basket', category: 'Survival', description: 'Steel-woven wicker. More basket health.', levels: ['+20 HP', '+40 HP', '+65 HP', '+90 HP', '+120 HP'], costs: costs(110, 5), requiredLevel: 1 },
  { id: 'insulation', name: 'Thermal Insulation', category: 'Survival', description: 'Heated basket and envelope liners resist cold and ice.', levels: ['+8° cold resist', '+16°', '+24°', '+32°', '+42°'], costs: costs(250, 5), requiredLevel: 3 },
  { id: 'oxygen', name: 'Oxygen System', category: 'Survival', description: 'Larger oxygen tanks for the thin air.', levels: ['+40% O₂', '+80% O₂', '+130% O₂', '+190% O₂', '+260% O₂'], costs: costs(300, 5), requiredLevel: 3 },
  { id: 'toolbox', name: 'Repair Toolbox', category: 'Survival', description: 'Extra repair materials and faster patching.', levels: ['+2 materials', '+4 materials', '+6, faster', '+9, fastest'], costs: costs(180, 4), requiredLevel: 2 },
  { id: 'lightningRod', name: 'Lightning Rod', category: 'Tools', description: 'Grounding rod absorbs lightning strikes for a short time. Earns coins per strike absorbed.', levels: ['1 charge', '2 charges', '3 charges'], costs: costs(350, 3, 2.2), requiredLevel: 3 },
  { id: 'shield', name: 'Energy Shield', category: 'Tools', description: 'Bubble shield blocks hail, debris, meteors and energy arcs.', levels: ['1 charge', '2 charges', '3 charges'], costs: costs(700, 3, 2.2), requiredLevel: 5 },
  { id: 'deicer', name: 'De-Icer', category: 'Tools', description: 'Instantly melts accumulated ice and warms the valves.', levels: ['1 charge', '2 charges', '3 charges'], costs: costs(450, 3, 2.2), requiredLevel: 4 },
  { id: 'ballast', name: 'Emergency Ballast', category: 'Tools', description: 'Dump sandbags for a burst of upward speed. Escapes microbursts.', levels: ['1 charge', '2 charges', '3 charges'], costs: costs(200, 3, 2.2), requiredLevel: 1 },
  { id: 'thruster', name: 'Experimental Thruster', category: 'Tools', description: 'A sideways rocket dash. Escapes tornado suction.', levels: ['1 charge', '2 charges', '3 charges'], costs: costs(600, 3, 2.2), requiredLevel: 4 },
  { id: 'radar', name: 'Storm Radar', category: 'Utility', description: 'Earlier warnings and better visibility in fog, dust and ash.', levels: ['+25% warning', '+50% warning, clearer', '+80% warning, clearest'], costs: costs(400, 3, 2.1), requiredLevel: 2 },
  { id: 'magnet', name: 'Collector Magnet', category: 'Utility', description: 'Pulls nearby collectibles towards the basket.', levels: ['Small pull', 'Medium pull', 'Large pull', 'Huge pull'], costs: costs(260, 4), requiredLevel: 2 },
];

export const upgradeById = (id: string) => UPGRADES.find((u) => u.id === id)!;
