import { balloonById, type BalloonDef } from '../../data/balloons';
import { characterById, type CharacterDef } from '../../data/characters';
import { combine, type Modifiers } from '../../data/modifiers';
import { RESOURCES, type Difficulty } from '../../data/config';
import type { ToolId } from '../../data/tools';
import { DEFAULT_FLIGHT_MODS, type FlightModifiers } from '../core/types';

export interface Loadout {
  character: CharacterDef;
  balloon: BalloonDef;
  mods: Modifiers;
  maxFuel: number;
  maxEnvelope: number;
  maxBasket: number;
  maxOxygen: number;
  burnerMult: number;
  liftMult: number;
  steerAccel: number;
  thinAirResist: number;
  coldResist: number;
  magnetRadius: number;
  repairMaterials: number;
  repairSpeed: number;
  warningMult: number;
  visibility: number;
  tools: Partial<Record<ToolId, number>>;
  difficulty: Difficulty;
  flight: FlightModifiers;
  playerLevel: number;
}

const ENVELOPE_HP = [0, 20, 40, 60, 85, 110, 140];
const BASKET_HP = [0, 20, 40, 65, 90, 120];
const FUEL = [0, 0.2, 0.4, 0.6, 0.85, 1.1, 1.4];
const OXY = [0, 0.4, 0.8, 1.3, 1.9, 2.6];
const STRATO = [0, 0.25, 0.45, 0.65, 0.85];
const TOOLBOX = [0, 2, 4, 6, 9];

export interface LoadoutInput {
  characterId: string;
  balloonId: string;
  upgrades: Record<string, number>;
  difficulty: Difficulty;
  flight?: Partial<FlightModifiers>;
  playerLevel: number;
}

export function buildLoadout(inp: LoadoutInput): Loadout {
  const character = characterById(inp.characterId);
  const balloon = balloonById(inp.balloonId);
  const mods = combine(character.modifiers, balloon.modifiers);
  const u = (id: string) => inp.upgrades[id] ?? 0;
  const flight = { ...DEFAULT_FLIGHT_MODS, ...inp.flight };
  const tools: Partial<Record<ToolId, number>> = {};
  for (const id of ['ballast', 'lightningRod', 'shield', 'deicer', 'thruster'] as ToolId[]) {
    if (u(id) > 0) tools[id] = u(id);
  }
  return {
    character,
    balloon,
    mods,
    maxFuel: balloon.fuelCapacity * (1 + FUEL[u('fuelTank')]) * flight.fuel,
    maxEnvelope: balloon.envelopeHp + ENVELOPE_HP[u('envelope')],
    maxBasket: balloon.basketHp + BASKET_HP[u('basket')],
    maxOxygen: 100 * (1 + OXY[u('oxygen')]),
    burnerMult: 1 + 0.12 * u('burner') + (u('burner') >= 6 ? 0.03 : 0),
    liftMult: mods.lift * (1 + 0.05 * u('burner')),
    steerAccel: flight.noFans ? 0.6 : (2.2 + 1.7 * u('fans')) * mods.steer,
    thinAirResist: STRATO[u('stratoEnvelope')],
    coldResist: mods.coldResist + 8 * u('insulation') + (u('insulation') >= 5 ? 2 : 0),
    magnetRadius: u('magnet') * 3.5,
    repairMaterials: RESOURCES.startingRepairKits * 2 + TOOLBOX[u('toolbox')],
    repairSpeed: 1 + (u('toolbox') >= 3 ? 0.35 : 0) + (u('toolbox') >= 4 ? 0.35 : 0),
    warningMult: mods.warningTime * [1, 1.25, 1.5, 1.8][u('radar')],
    visibility: [1, 1.15, 1.45, 1.8][u('radar')],
    tools,
    difficulty: inp.difficulty,
    flight,
    playerLevel: inp.playerLevel,
  };
}
