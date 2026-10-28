/** Multiplicative/additive stat modifiers granted by characters and balloons. */
export interface Modifiers {
  steer: number;
  warningTime: number;
  repairCost: number;
  rareChance: number;
  nearMissReward: number;
  fuelUse: number;
  oxygenUse: number;
  coldResist: number;
  damageTaken: number;
  lift: number;
  coinGain: number;
}

export const BASE_MODIFIERS: Modifiers = {
  steer: 1,
  warningTime: 1,
  repairCost: 1,
  rareChance: 1,
  nearMissReward: 1,
  fuelUse: 1,
  oxygenUse: 1,
  coldResist: 0,
  damageTaken: 1,
  lift: 1,
  coinGain: 1,
};

export function combine(...mods: Partial<Modifiers>[]): Modifiers {
  const out = { ...BASE_MODIFIERS };
  for (const m of mods) {
    for (const k of Object.keys(m) as (keyof Modifiers)[]) {
      const v = m[k]!;
      if (k === 'coldResist') out[k] += v;
      else out[k] *= v;
    }
  }
  return out;
}
