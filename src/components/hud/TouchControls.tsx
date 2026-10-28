import { useEffect, useState, type ReactNode } from 'react';
import { useGame, type HudSnapshot } from '../../app/store';
import { getEngineInstance } from '../../app/engineHost';
import { toolById } from '../../data/tools';
import type { Action } from '../../game/persistence/save';
import { audio } from '../../game/audio/audio';

/** True on phones/tablets, or as soon as the player touches the screen. */
export function useTouchMode(): boolean {
  const [touch, setTouch] = useState(() => typeof matchMedia !== 'undefined' && (matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0));
  useEffect(() => {
    if (touch) return;
    const on = () => setTouch(true);
    window.addEventListener('touchstart', on, { once: true });
    return () => window.removeEventListener('touchstart', on);
  }, [touch]);
  return touch;
}

/** A button that holds an action while a finger is on it (multi-touch safe). */
function Hold({ action, className, children, label }: { action: Action; className: string; children: ReactNode; label: string }) {
  const [down, setDown] = useState(false);
  const set = (v: boolean) => {
    setDown(v);
    getEngineInstance()?.touchHold(action, v);
  };
  return (
    <button
      className={`tc-btn ${className} ${down ? 'down' : ''}`}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        audio.unlock();
        set(true);
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onLostPointerCapture={() => set(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

function Tap({ onTap, className, children, label }: { onTap: () => void; className: string; children: ReactNode; label: string }) {
  return (
    <button
      className={`tc-btn ${className}`}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        audio.unlock();
        onTap();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

/** On-screen controls for phones: steering on the left, burner/vent/boost on the right. */
export function TouchControls({ h }: { h: HudSnapshot }) {
  const special = useGame((s) => s.special);
  const e = () => getEngineInstance();
  return (
    <div className="touch-controls">
      <div className="tc-top">
        <Tap className="tc-small" label="Pause" onTap={() => useGame.getState().setPaused(true)}>⏸</Tap>
        <Tap className={`tc-small ${special === 'hyper' ? 'lit' : ''}`} label="Hyperion X" onTap={() => e()?.toggleSpecial('hyper')}>🚀</Tap>
        <Tap className={`tc-small ${special === 'insano' ? 'lit hot' : ''}`} label="Insano X" onTap={() => e()?.toggleSpecial('insano')}>🔥</Tap>
      </div>
      <div className="tc-left">
        <Hold action="left" className="tc-steer" label="Steer left">◀</Hold>
        <Hold action="right" className="tc-steer" label="Steer right">▶</Hold>
      </div>
      <div className="tc-right">
        <Hold action="boost" className="tc-boost" label="Emergency boost">BOOST</Hold>
        <Hold action="vent" className="tc-vent" label="Vent">
          <span>⬇</span>
          <small>VENT</small>
        </Hold>
        <Hold action="burner" className="tc-burn" label="Burner">
          <span>🔥</span>
          <small>BURN</small>
        </Hold>
      </div>
      {h.noFuel && !h.dying && (
        <Tap className="tc-bail" label="Parachute down" onTap={() => e()?.touchBail()}>🪂 Parachute down</Tap>
      )}
    </div>
  );
}

/** Toolbar slots become buttons on touch: tap the selected tool to use it, tap another to select it. */
export function useToolTap(h: HudSnapshot, touch: boolean) {
  return {
    tool: (id: string) =>
      touch
        ? () => {
            audio.unlock();
            if (h.currentTool === id) getEngineInstance()?.touchPress('tool');
            else getEngineInstance()?.selectTool(id);
          }
        : undefined,
    repair: touch ? () => getEngineInstance()?.touchPress('repair') : undefined,
    label: (id: string) => (h.currentTool === id ? 'TAP' : toolById(id as never).icon),
  };
}
