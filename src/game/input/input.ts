import type { Action, Settings } from '../persistence/save';
import { emptyInput, type SimInput } from '../simulation';
import type { SpecialId } from '../../data/config';

/** Keyboard + mouse input with rebinding support and edge-triggered actions. */
export class InputManager {
  private down = new Set<string>();
  private pressed = new Set<Action>();
  private mouseButtons = new Set<number>();
  mouseX = 0;
  mouseY = 0;
  dragDX = 0;
  dragDY = 0;
  wheel = 0;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  enabled = false;
  onAction?: (a: Action) => void;
  /** F1 / F2 toggle the secret Hyperion X / Insano X balloons (menus and flight). */
  onSpecial?: (id: SpecialId) => void;
  private captureCallback: ((code: string) => void) | null = null;
  private bail = false;

  constructor(private getSettings: () => Settings, el: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('help', (e) => e.preventDefault());
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.down.clear());
    el.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    el.addEventListener('wheel', this.onWheel, { passive: true });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Next key pressed is handed to the callback (used for rebinding). */
  captureNextKey(cb: (code: string) => void) {
    this.captureCallback = cb;
  }

  private actionFor(code: string): Action | null {
    const b = this.getSettings().bindings;
    for (const a of Object.keys(b) as Action[]) if (b[a].includes(code)) return a;
    return null;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.captureCallback) {
      e.preventDefault();
      const cb = this.captureCallback;
      this.captureCallback = null;
      cb(e.code);
      return;
    }
    if (e.code === 'F1' || e.code === 'F2') {
      e.preventDefault();
      if (!e.repeat) this.onSpecial?.(e.code === 'F1' ? 'hyper' : 'insano');
      return;
    }
    const a = this.actionFor(e.code);
    if (this.enabled && a && (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow'))) e.preventDefault();
    if (!this.down.has(e.code) && a) {
      this.pressed.add(a);
      if (this.enabled) this.onAction?.(a);
    }
    if (e.code === 'Enter' && this.enabled) this.bail = true;
    this.down.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };
  private onMouseDown = (e: MouseEvent) => {
    this.mouseButtons.add(e.button);
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };
  private onMouseUp = (e: MouseEvent) => {
    this.mouseButtons.delete(e.button);
    this.dragging = false;
  };
  private onMouseMove = (e: MouseEvent) => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    if (this.dragging && this.getSettings().controlMode === 'keyboard') {
      this.dragDX += e.clientX - this.lastX;
      this.dragDY += e.clientY - this.lastY;
    }
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };
  private onWheel = (e: WheelEvent) => {
    this.wheel += Math.sign(e.deltaY);
  };

  isDown(a: Action): boolean {
    const codes = this.getSettings().bindings[a];
    for (const c of codes) if (this.down.has(c)) return true;
    return false;
  }

  /** Build this step's simulation input. Edge actions are consumed. */
  sample(): SimInput {
    const s = this.getSettings();
    const inp = emptyInput();
    inp.burner = this.isDown('burner');
    inp.vent = this.isDown('vent');
    inp.boost = this.isDown('boost');
    inp.steer = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    if (s.controlMode === 'mouse') {
      if (this.mouseButtons.has(0)) inp.burner = true;
      if (this.mouseButtons.has(2)) inp.vent = true;
      if (inp.steer === 0) {
        const w = window.innerWidth;
        const dx = (this.mouseX - w / 2) / (w * 0.22);
        inp.steer = Math.abs(dx) < 0.12 ? 0 : Math.max(-1, Math.min(1, dx));
      }
    }
    inp.useTool = this.pressed.has('tool');
    inp.switchTool = this.pressed.has('switchTool');
    inp.repair = this.pressed.has('repair');
    inp.bail = this.bail;
    this.bail = false;
    this.pressed.clear();
    return inp;
  }

  consumeCamera() {
    const r = { dx: this.dragDX, dy: this.dragDY, wheel: this.wheel };
    this.dragDX = this.dragDY = this.wheel = 0;
    return r;
  }

  clear() {
    this.down.clear();
    this.pressed.clear();
    this.mouseButtons.clear();
    this.bail = false;
  }
}
