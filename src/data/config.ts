/**
 * Central balancing table. Gameplay code reads every tunable value from here.
 * Units: "u" = playfield units (~1 m near the ground). Displayed altitude is a
 * stretched mapping of playfield height so later zones arrive in reasonable time.
 */
export const SIM = {
  step: 1 / 60,
  maxSubSteps: 6,
  hudHz: 20,
};

export const ALTITUDE = {
  /** A(y) = scale * (exp(y/scale) - 1); dA/dy = 1 + A/scale. */
  stretch: 1800,
  floatingOriginChunk: 400,
  minAltitudeForLanding: 120,
};

export const PHYSICS = {
  heatNeutral: 0.5,
  heatAmbient: 0.18,
  heatMax: 1.6,
  startHeat: 0.47,
  burnerHeatRate: 0.22,
  boostMultiplier: 2.1,
  coolRate: 0.07,
  ventCoolRate: 0.3,
  liftK: 26,
  quadDrag: 0.32,
  linDrag: 0.25,
  windCoupling: 0.55,
  baseSteerAccel: 2.2,
  maxLateralSpeed: 32,
  fuelPerSecond: 1.3,
  boostFuelMultiplier: 3,
  iceMassFactor: 0.45,
  envelopeRadius: 7.5,
  envelopeOffsetY: 13,
  basketRadius: 2.2,
  groundCrashSpeed: 6.5,
  groundDamagePerSpeed: 9,
  sliceZRange: 0,
};

export const RESOURCES = {
  oxygenStartAltitude: 6000,
  oxygenUsePerSecond: 1.1,
  hypoxiaDamage: 3.5,
  coldThreshold: -12,
  coldEquipmentDamage: 0.45,
  iceRatePerColdDegree: 0.0009,
  burnerMeltRate: 0.012,
  equipmentFailureThreshold: 30,
  repairDuration: 1.6,
  repairAmount: 35,
  repairKitCost: 1,
  repairCooldown: 0.3,
  startingRepairKits: 2,
};

export const PACING = {
  calmMin: 14,
  calmMax: 24,
  calmShrinkPerKm: 0.06,
  calmFloor: 6,
  warningTime: 5,
  resolveTime: 3,
  rewardTime: 6,
  firstEventDelay: 16,
  firstEventMinAltitude: 300,
  noviceLevel: 3,
  noviceCalmBonus: 8,
  noviceIntensityPenalty: 0.8,
  lowHealthEase: 0.35,
};

export const TRAFFIC = {
  baseSpawnInterval: 4.2,
  minSpawnInterval: 1.1,
  intervalShrinkPerZone: 0.35,
  spawnDistanceX: 80,
  minSpawnDistance: 40,
  reactionWindow: 2.6,
  nearMissMargin: 4.5,
  despawnDistance: 190,
  maxActive: 28,
};

export const COLLECT = {
  spawnInterval: 1.9,
  pickupRadius: 5.5,
  magnetRadiusPerLevel: 3.5,
  aheadMin: 45,
  aheadMax: 130,
  lateralSpread: 42,
  maxActive: 40,
};

export const ECONOMY = {
  coinsPerKm: 22,
  coinValue: 1,
  bigCoinValue: 5,
  shardValue: 1,
  relicCoins: 250,
  disasterSurvivalBase: 18,
  nearMissCoins: 3,
  recordBonus: 50,
  safeLandingBonus: 0.25,
  xpPerKm: 30,
  xpPerDisaster: 25,
  levelXpBase: 120,
  levelXpGrowth: 1.28,
  milestones: [500, 1000, 2000, 3000, 5000, 6000, 8000, 10000, 15000, 22000, 30000, 35000, 50000, 60000, 80000, 100000, 125000, 150000, 200000, 300000, 500000],
};

export const DIFFICULTY = {
  relaxed: { damage: 0.6, intensity: 0.75, spawn: 0.8, reward: 0.85 },
  normal: { damage: 1, intensity: 1, spawn: 1, reward: 1 },
  hardcore: { damage: 1.45, intensity: 1.3, spawn: 1.25, reward: 1.35 },
} as const;
export type Difficulty = keyof typeof DIFFICULTY;

export const INTENSITY_NAMES = ['Mild', 'Moderate', 'Severe', 'Extreme', 'Legendary'] as const;
