import { PHYSICS } from '../../data/config';
import { clamp } from '../core/math';

export interface BalloonBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heat: number;
  fuel: number;
  ice: number;
  equipment: number;
}

export interface ControlInput {
  burner: boolean;
  vent: boolean;
  boost: boolean;
  steer: number;
}

export interface PhysicsEnv {
  windX: number;
  accelX: number;
  accelY: number;
  liftFactor: number;
  burnerEfficiency: number;
  valveEfficiency: number;
}

export interface PhysicsParams {
  burnerMult: number;
  liftMult: number;
  steerAccel: number;
  fuelUse: number;
  heatMaxMult: number;
}

export interface PhysicsStepOut {
  burning: boolean;
  fuelUsed: number;
}

/**
 * Advance the balloon body one fixed step. Heat drives buoyancy; the balloon only
 * responds through acceleration so it always carries momentum.
 */
export function stepBalloon(b: BalloonBody, input: ControlInput, env: PhysicsEnv, p: PhysicsParams, dt: number): PhysicsStepOut {
  const P = PHYSICS;
  const canBurn = b.fuel > 0 && input.burner;
  const boost = canBurn && input.boost;
  let fuelUsed = 0;
  if (canBurn) {
    const rate = P.burnerHeatRate * p.burnerMult * env.burnerEfficiency * (boost ? P.boostMultiplier : 1);
    b.heat += rate * dt;
    fuelUsed = P.fuelPerSecond * p.fuelUse * (boost ? P.boostFuelMultiplier : 1) * dt;
    b.fuel = Math.max(0, b.fuel - fuelUsed);
  }
  b.heat -= P.coolRate * (b.heat - P.heatAmbient) * dt;
  if (input.vent) b.heat -= P.ventCoolRate * env.valveEfficiency * dt;
  b.heat = clamp(b.heat, P.heatAmbient - 0.05, P.heatMax * p.heatMaxMult);

  const mass = 1 + b.ice * P.iceMassFactor;
  const neutral = P.heatNeutral * mass;
  const lift = P.liftK * (b.heat - neutral) * env.liftFactor * p.liftMult / mass;
  const ay = lift - P.quadDrag * b.vy * Math.abs(b.vy) - P.linDrag * b.vy + env.accelY;
  b.vy += ay * dt;

  const ax = P.windCoupling * (env.windX - b.vx) + clamp(input.steer, -1, 1) * p.steerAccel + env.accelX;
  b.vx = clamp(b.vx + ax * dt, -P.maxLateralSpeed, P.maxLateralSpeed);

  b.x += b.vx * dt;
  b.y += b.vy * dt;
  return { burning: canBurn, fuelUsed };
}
