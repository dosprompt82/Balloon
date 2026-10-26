import { GameEngine } from '../game/render/engine';
import { registerEngine } from './store';

let engine: GameEngine | null = null;

export function mountEngine(el: HTMLElement): GameEngine {
  if (!engine) {
    engine = new GameEngine(el);
    registerEngine(engine);
    (window as unknown as { __skybound: GameEngine }).__skybound = engine;
  }
  return engine;
}

export function requestKeyCapture(cb: (code: string) => void) {
  engine?.captureKey(cb);
}
