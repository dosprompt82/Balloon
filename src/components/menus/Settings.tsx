import { useState } from 'react';
import { useGame } from '../../app/store';
import { Btn, ScreenFrame } from '../ui';
import { DEFAULT_BINDINGS, type Action } from '../../game/persistence/save';
import { requestKeyCapture } from '../../app/engineHost';

const ACTION_NAMES: Record<Action, string> = {
  burner: 'Burner (climb)', vent: 'Vent (descend)', left: 'Steer left', right: 'Steer right', boost: 'Emergency boost',
  tool: 'Use tool', repair: 'Repair / interact', switchTool: 'Switch tool', equipment: 'Equipment panel', pause: 'Pause',
};

const keyName = (c: string) => c.replace('Key', '').replace('Arrow', '↑↓←→'.includes(c) ? '' : 'Arrow ').replace('Left', ' L').replace('Right', ' R');

export function Settings() {
  const { save, setSettings, resetProgress, toast } = useGame();
  const s = save.settings;
  const [listening, setListening] = useState<Action | null>(null);
  const [confirm, setConfirm] = useState(false);

  const rebind = (a: Action) => {
    setListening(a);
    requestKeyCapture((code) => {
      setListening(null);
      if (code === 'Escape' && a !== 'pause') return;
      const b = structuredClone(s.bindings);
      for (const k of Object.keys(b) as Action[]) b[k] = b[k].filter((c) => c !== code);
      b[a] = [code, ...b[a].filter((c) => c !== code)].slice(0, 2);
      setSettings({ bindings: b });
    });
  };

  return (
    <ScreenFrame title="Settings" testId="settings-screen">
      <div className="label">Audio</div>
      {(['master', 'music', 'sfx'] as const).map((k) => (
        <div className="row" key={k} style={{ fontWeight: 800 }}>
          <span style={{ width: 120, textTransform: 'capitalize' }}>{k === 'sfx' ? 'Effects' : k}</span>
          <input type="range" min={0} max={1} step={0.05} value={s[k]} onChange={(e) => setSettings({ [k]: Number(e.target.value) })} />
          <span>{Math.round(s[k] * 100)}%</span>
        </div>
      ))}
      <div className="label">Gameplay</div>
      <div className="row" style={{ fontWeight: 800 }}>
        <span style={{ width: 120 }}>Difficulty</span>
        <select value={s.difficulty} onChange={(e) => setSettings({ difficulty: e.target.value as typeof s.difficulty })} data-testid="difficulty">
          <option value="relaxed">Relaxed — gentler damage</option>
          <option value="normal">Normal</option>
          <option value="hardcore">Hardcore — +35% rewards</option>
        </select>
      </div>
      <div className="row" style={{ fontWeight: 800, marginTop: 8 }}>
        <span style={{ width: 120 }}>Controls</span>
        <select value={s.controlMode} onChange={(e) => setSettings({ controlMode: e.target.value as typeof s.controlMode })}>
          <option value="keyboard">Keyboard (mouse drag rotates camera)</option>
          <option value="mouse">Mouse (L = burner, R = vent, aim to steer)</option>
        </select>
      </div>
      <div className="row" style={{ fontWeight: 800, marginTop: 8 }}>
        <span style={{ width: 120 }}>Tutorial hints</span>
        <input type="checkbox" checked={s.showHints} onChange={(e) => setSettings({ showHints: e.target.checked })} />
      </div>
      <div className="label">Graphics & comfort</div>
      <div className="row" style={{ fontWeight: 800 }}>
        <span style={{ width: 120 }}>Quality</span>
        <select value={s.quality} onChange={(e) => setSettings({ quality: e.target.value as typeof s.quality })}>
          <option value="low">Low (fast)</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div className="row" style={{ fontWeight: 800, marginTop: 8 }}>
        <span style={{ width: 120 }}>Camera shake</span>
        <input type="range" min={0} max={1} step={0.05} value={s.shake} onChange={(e) => setSettings({ shake: Number(e.target.value) })} />
        <span>{Math.round(s.shake * 100)}%</span>
      </div>
      <div className="label">Key bindings (click to rebind)</div>
      {(Object.keys(ACTION_NAMES) as Action[]).map((a) => (
        <div className="row" key={a} style={{ fontWeight: 800, marginBottom: 6 }}>
          <span style={{ width: 170 }}>{ACTION_NAMES[a]}</span>
          <Btn className="ghost small keybind" onClick={() => rebind(a)}>
            {listening === a ? 'Press a key…' : s.bindings[a].map(keyName).join(' / ')}
          </Btn>
        </div>
      ))}
      <Btn className="ghost small" onClick={() => setSettings({ bindings: structuredClone(DEFAULT_BINDINGS) })}>
        Restore default keys
      </Btn>
      <div className="label">Save data</div>
      {!confirm ? (
        <Btn className="small" onClick={() => setConfirm(true)}>
          Reset all progress…
        </Btn>
      ) : (
        <div className="row">
          <b>Erase everything?</b>
          <Btn
            className="small"
            onClick={() => {
              resetProgress();
              setConfirm(false);
              toast({ text: 'Progress reset', kind: 'warn' });
            }}
          >
            Yes, erase
          </Btn>
          <Btn className="ghost small" onClick={() => setConfirm(false)}>
            Cancel
          </Btn>
        </div>
      )}
    </ScreenFrame>
  );
}
