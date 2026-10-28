export type ToolId = 'ballast' | 'lightningRod' | 'shield' | 'deicer' | 'thruster';

export interface ToolDef {
  id: ToolId;
  name: string;
  icon: string;
  duration: number;
  description: string;
}

export const TOOLS: ToolDef[] = [
  { id: 'ballast', name: 'Ballast', icon: '⬆', duration: 0, description: 'Instant upward burst' },
  { id: 'lightningRod', name: 'Lightning Rod', icon: '⚡', duration: 9, description: 'Absorbs lightning' },
  { id: 'shield', name: 'Shield', icon: '◯', duration: 7, description: 'Blocks impacts' },
  { id: 'deicer', name: 'De-Icer', icon: '❄', duration: 0, description: 'Clears all ice' },
  { id: 'thruster', name: 'Thruster', icon: '➤', duration: 0, description: 'Sideways dash' },
];

export const TOOL_TUNING = {
  ballastImpulse: 14,
  ballastHeat: 0.25,
  thrusterImpulse: 34,
  thrusterTornadoImmunity: 1.5,
};

export const toolById = (id: ToolId) => TOOLS.find((t) => t.id === id)!;
