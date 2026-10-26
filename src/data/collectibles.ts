export type CollectibleId = 'coin' | 'bigCoin' | 'fuel' | 'repair' | 'oxygen' | 'shard' | 'relic';

export interface CollectibleDef {
  id: CollectibleId;
  name: string;
  weight: number;
  minAlt: number;
  rare: boolean;
  color: string;
  /** Effect amount: coins, fuel %, materials, oxygen %, shards. */
  amount: number;
}

export const COLLECTIBLES: CollectibleDef[] = [
  { id: 'coin', name: 'Sky Coin', weight: 10, minAlt: 0, rare: false, color: '#ffd166', amount: 1 },
  { id: 'bigCoin', name: 'Gold Medallion', weight: 1.4, minAlt: 500, rare: false, color: '#ffb703', amount: 5 },
  { id: 'fuel', name: 'Fuel Canister', weight: 2.2, minAlt: 0, rare: false, color: '#ef476f', amount: 22 },
  { id: 'repair', name: 'Repair Kit', weight: 1.1, minAlt: 0, rare: false, color: '#06d6a0', amount: 2 },
  { id: 'oxygen', name: 'Oxygen Bubble', weight: 2, minAlt: 5000, rare: false, color: '#8ecae6', amount: 30 },
  { id: 'shard', name: 'Star Shard', weight: 0.35, minAlt: 2000, rare: true, color: '#c77dff', amount: 1 },
  { id: 'relic', name: 'Legendary Sky Relic', weight: 0.06, minAlt: 40000, rare: true, color: '#00f5d4', amount: 1 },
];
