/**
 * Fixed-timestep accumulator. Simulation always advances in exact `step` increments,
 * rendering interpolates with the leftover alpha.
 */
export class FixedStepLoop {
  private acc = 0;
  constructor(
    public readonly step: number,
    private readonly maxSteps: number,
  ) {}
  advance(frameDt: number, tick: (dt: number) => void): number {
    this.acc += Math.min(frameDt, this.step * this.maxSteps);
    let n = 0;
    while (this.acc >= this.step && n < this.maxSteps) {
      tick(this.step);
      this.acc -= this.step;
      n++;
    }
    if (n === this.maxSteps) this.acc = Math.min(this.acc, this.step);
    return this.acc / this.step;
  }
  reset() {
    this.acc = 0;
  }
}
