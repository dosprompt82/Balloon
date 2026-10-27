import { GameEngine } from '../game/render/engine';
import { registerEngine, useGame } from './store';

let engine: GameEngine | null = null;

export function mountEngine(el: HTMLElement): GameEngine {
  if (!engine) {
    engine = new GameEngine(el);
    registerEngine(engine);
    const w = window as unknown as { __skybound: GameEngine; __skyboundStore: typeof useGame };
    w.__skybound = engine;
    w.__skyboundStore = useGame;
  }
  return engine;
}

export function requestKeyCapture(cb: (code: string) => void) {
  engine?.captureKey(cb);
}
