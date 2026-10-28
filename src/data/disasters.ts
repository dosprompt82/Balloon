import type { ToolId } from './tools';

export type DisasterId =
  | 'thunderstorm' | 'tornado' | 'hurricane' | 'hailstorm' | 'volcano' | 'iceStorm'
  | 'microburst' | 'windShear' | 'dustStorm' | 'supercell' | 'meteorShower' | 'energyStorm';

export interface DisasterDef {
  id: DisasterId;
  name: string;
  icon: string;
  minAlt: number;
  maxAlt: number;
  weight: number;
  duration: [number, number];
  warning: string;
  counter: string;
  counterTool?: ToolId;
  color: string;
  /** Darkens the sky / lighting while active (0..1). */
  gloom: number;
  /** Fog density multiplier (visibility). */
  fog: number;
  major?: boolean;
}

export const DISASTERS: DisasterDef[] = [
  { id: 'thunderstorm', name: 'Thunderstorm', icon: '⛈', minAlt: 1800, maxAlt: 36000, weight: 1.2, duration: [18, 26], warning: 'Thunderstorm approaching — watch for glowing strike zones!', counter: 'Avoid crackling hotspots or deploy the Lightning Rod.', counterTool: 'lightningRod', color: '#ffe066', gloom: 0.55, fog: 1.6 },
  { id: 'tornado', name: 'Tornado', icon: '🌪', minAlt: 4500, maxAlt: 16000, weight: 1.1, duration: [18, 28], warning: 'Tornado forming! Stay away from the funnel’s pull.', counter: 'Steer or change wind layers away; Thruster breaks free.', counterTool: 'thruster', color: '#b9a37e', gloom: 0.4, fog: 1.3, major: true },
  { id: 'hurricane', name: 'Hurricane Bands', icon: '🌀', minAlt: 2000, maxAlt: 22000, weight: 0.8, duration: [18, 24], warning: 'Hurricane winds incoming — find the calm corridors.', counter: 'Climb or descend into the marked calm corridors.', color: '#7fb3d5', gloom: 0.35, fog: 1.8 },
  { id: 'hailstorm', name: 'Hailstorm', icon: '🧊', minAlt: 2500, maxAlt: 16000, weight: 1, duration: [15, 22], warning: 'Hail clouds overhead — dodge the dark shafts!', counter: 'Avoid falling hail shafts or raise the Shield.', counterTool: 'shield', color: '#dff6ff', gloom: 0.3, fog: 1.2 },
  { id: 'volcano', name: 'Volcanic Eruption', icon: '🌋', minAlt: 0, maxAlt: 7500, weight: 1, duration: [18, 25], warning: 'Volcano erupting below! Keep clear of the ash plume.', counter: 'Steer away from the rising plume column.', color: '#ff6b35', gloom: 0.35, fog: 1.4 },
  { id: 'iceStorm', name: 'Ice Storm', icon: '❄', minAlt: 8500, maxAlt: 45000, weight: 1, duration: [16, 24], warning: 'Freezing front ahead — ice will weigh you down.', counter: 'Use the De-Icer, burn hot, or leave the freezing band.', counterTool: 'deicer', color: '#a8e6ff', gloom: 0.2, fog: 1.5 },
  { id: 'microburst', name: 'Microburst', icon: '⬇', minAlt: 600, maxAlt: 14000, weight: 1, duration: [10, 14], warning: 'Microburst! A violent downdraft is collapsing — get clear!', counter: 'Steer out of the shaft, burn hard, or drop Ballast.', counterTool: 'ballast', color: '#9fa8da', gloom: 0.25, fog: 1 },
  { id: 'windShear', name: 'Wind Shear', icon: '〰', minAlt: 1500, maxAlt: 70000, weight: 0.9, duration: [12, 18], warning: 'Wind shear — gusts will whip left and right!', counter: 'Counter-steer and keep a steady climb.', color: '#c3f0ca', gloom: 0.1, fog: 1 },
  { id: 'dustStorm', name: 'Dust Storm', icon: '🌫', minAlt: 200, maxAlt: 6000, weight: 0.8, duration: [15, 22], warning: 'A wall of dust is rolling in — visibility dropping.', counter: 'Climb above the dust band; Radar clears the view.', color: '#d9a066', gloom: 0.25, fog: 3.5 },
  { id: 'supercell', name: 'Lightning Supercell', icon: '⚡', minAlt: 4000, maxAlt: 36000, weight: 0.6, duration: [24, 32], warning: 'SUPERCELL! Repeated lightning, violent wind — brace yourself!', counter: 'Lightning Rod + careful steering. Survive for big rewards.', counterTool: 'lightningRod', color: '#fff3b0', gloom: 0.75, fog: 2, major: true },
  { id: 'meteorShower', name: 'Meteor Shower', icon: '☄', minAlt: 35000, maxAlt: Infinity, weight: 1.2, duration: [16, 24], warning: 'Meteor shower! Watch the glowing trajectory lines.', counter: 'Read the trajectories and slip through the gaps; Shield blocks impacts.', counterTool: 'shield', color: '#ff9f1c', gloom: 0, fog: 1 },
  { id: 'energyStorm', name: 'Celestial Energy Storm', icon: '✶', minAlt: 55000, maxAlt: Infinity, weight: 1, duration: [18, 26], warning: 'Celestial energy surge — arcs will span the sky!', counter: 'Fly through the gaps between arcs; Shield absorbs energy.', counterTool: 'shield', color: '#c77dff', gloom: 0, fog: 1, major: true },
];

export const disasterById = (id: DisasterId) => DISASTERS.find((d) => d.id === id)!;
