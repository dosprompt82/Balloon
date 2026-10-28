export type ObstacleId =
  | 'birds' | 'geese' | 'plane' | 'helicopter' | 'weatherBalloon' | 'debris' | 'cargo'
  | 'glider' | 'drone' | 'iceShard' | 'meteor' | 'spaceJunk' | 'skyJelly' | 'anomaly' | 'lavaBomb';

export type MovePattern = 'cross' | 'fall' | 'rise' | 'bob' | 'zigzag' | 'diagonal' | 'drift' | 'pulse' | 'ballistic';

export interface ObstacleDef {
  id: ObstacleId;
  name: string;
  minAlt: number;
  maxAlt: number;
  weight: number;
  radius: number;
  speed: [number, number];
  damage: number;
  pattern: MovePattern;
  /** Also damages the basket if it hits low. */
  hitsBasket: boolean;
  color: string;
}

export const OBSTACLES: ObstacleDef[] = [
  { id: 'birds', name: 'Bird Flock', minAlt: 0, maxAlt: 4000, weight: 1.4, radius: 4, speed: [7, 11], damage: 7, pattern: 'bob', hitsBasket: true, color: '#3d405b' },
  { id: 'geese', name: 'Migrating Geese', minAlt: 600, maxAlt: 6000, weight: 1, radius: 5, speed: [9, 13], damage: 10, pattern: 'cross', hitsBasket: true, color: '#f1faee' },
  { id: 'plane', name: 'Small Aircraft', minAlt: 300, maxAlt: 9000, weight: 0.8, radius: 6, speed: [18, 26], damage: 28, pattern: 'cross', hitsBasket: true, color: '#e63946' },
  { id: 'helicopter', name: 'Helicopter', minAlt: 100, maxAlt: 4500, weight: 0.6, radius: 5.5, speed: [8, 12], damage: 22, pattern: 'bob', hitsBasket: true, color: '#ffb703' },
  { id: 'glider', name: 'Glider', minAlt: 400, maxAlt: 5000, weight: 0.6, radius: 6, speed: [11, 15], damage: 16, pattern: 'diagonal', hitsBasket: true, color: '#ffffff' },
  { id: 'weatherBalloon', name: 'Weather Balloon', minAlt: 1500, maxAlt: 35000, weight: 0.7, radius: 3, speed: [2, 4], damage: 10, pattern: 'rise', hitsBasket: false, color: '#f8f9fa' },
  { id: 'drone', name: 'Rogue Drone', minAlt: 0, maxAlt: 12000, weight: 0.8, radius: 2.5, speed: [9, 14], damage: 12, pattern: 'zigzag', hitsBasket: true, color: '#212529' },
  { id: 'cargo', name: 'Loose Cargo', minAlt: 1500, maxAlt: 10000, weight: 0.6, radius: 3, speed: [6, 10], damage: 18, pattern: 'fall', hitsBasket: true, color: '#bc6c25' },
  { id: 'debris', name: 'Storm Debris', minAlt: 3000, maxAlt: 14000, weight: 0.8, radius: 2.5, speed: [10, 16], damage: 14, pattern: 'diagonal', hitsBasket: true, color: '#7f5539' },
  { id: 'iceShard', name: 'Ice Fragment', minAlt: 9000, maxAlt: 30000, weight: 1.1, radius: 3, speed: [9, 14], damage: 15, pattern: 'fall', hitsBasket: true, color: '#bde0fe' },
  { id: 'spaceJunk', name: 'Orbital Debris', minAlt: 22000, maxAlt: Infinity, weight: 1, radius: 3.5, speed: [14, 22], damage: 18, pattern: 'cross', hitsBasket: true, color: '#adb5bd' },
  { id: 'meteor', name: 'Falling Meteor', minAlt: 30000, maxAlt: Infinity, weight: 1.1, radius: 3.5, speed: [16, 24], damage: 24, pattern: 'diagonal', hitsBasket: true, color: '#ff7b00' },
  { id: 'skyJelly', name: 'Sky Jelly', minAlt: 60000, maxAlt: Infinity, weight: 0.8, radius: 5, speed: [3, 6], damage: 14, pattern: 'pulse', hitsBasket: false, color: '#9bf6ff' },
  { id: 'anomaly', name: 'Gravity Anomaly', minAlt: 60000, maxAlt: Infinity, weight: 0.6, radius: 9, speed: [2, 5], damage: 8, pattern: 'drift', hitsBasket: false, color: '#c77dff' },
];

/** Hazards that only disasters spawn (never chosen by sky traffic). */
export const DISASTER_OBSTACLES: ObstacleDef[] = [
  { id: 'debris', name: 'Tornado Debris', minAlt: 0, maxAlt: Infinity, weight: 0, radius: 2.4, speed: [11, 17], damage: 13, pattern: 'diagonal', hitsBasket: true, color: '#7f5539' },
  { id: 'meteor', name: 'Meteor', minAlt: 0, maxAlt: Infinity, weight: 0, radius: 3.2, speed: [22, 30], damage: 22, pattern: 'diagonal', hitsBasket: true, color: '#ff7b00' },
];
DISASTER_OBSTACLES.push({ id: 'lavaBomb', name: 'Lava Bomb', minAlt: 0, maxAlt: Infinity, weight: 0, radius: 2.6, speed: [24, 32], damage: 16, pattern: 'ballistic', hitsBasket: true, color: '#ff4800' });

export function obstacleDef(id: ObstacleId, fromDisaster = false): ObstacleDef {
  if (fromDisaster) {
    const d = DISASTER_OBSTACLES.find((o) => o.id === id);
    if (d) return d;
  }
  return OBSTACLES.find((o) => o.id === id) ?? DISASTER_OBSTACLES.find((o) => o.id === id)!;
}
