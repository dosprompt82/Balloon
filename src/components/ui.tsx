import type { ReactNode } from 'react';
import { useGame, type Screen } from '../app/store';
import { audio } from '../game/audio/audio';
import { fmt } from '../game/core/math';

export function Btn(props: { onClick?: () => void; children: ReactNode; className?: string; disabled?: boolean; title?: string; testId?: string }) {
  return (
    <button
      className={`btn ${props.className ?? ''}`}
      disabled={props.disabled}
      title={props.title}
      data-testid={props.testId}
      onMouseEnter={() => audio.play('hover')}
      onClick={() => {
        audio.unlock();
        audio.play('click');
        props.onClick?.();
      }}
    >
      {props.children}
    </button>
  );
}

export function Wallet() {
  const save = useGame((s) => s.save);
  return (
    <div className="chips">
      <span className="chip coins" data-testid="coins">🪙 {fmt(save.coins)}</span>
      <span className="chip shards">💎 {save.shards}</span>
      <span className="chip level">⭐ Lv {save.level}</span>
    </div>
  );
}

export function ScreenFrame(props: {
  title: string;
  children: ReactNode;
  wide?: boolean;
  right?: boolean;
  back?: Screen;
  footer?: ReactNode;
  testId?: string;
}) {
  const setScreen = useGame((s) => s.setScreen);
  return (
    <div className={`panel screen ${props.wide ? 'wide' : ''} ${props.right ? 'right' : ''}`} data-testid={props.testId}>
      <div className="screen-head">
        <Btn className="ghost small" onClick={() => setScreen(props.back ?? 'menu')}>
          ← Back
        </Btn>
        <h2>{props.title}</h2>
        <Wallet />
      </div>
      <div className="screen-body">{props.children}</div>
      {props.footer && <div className="screen-foot">{props.footer}</div>}
    </div>
  );
}

export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="bar">
      <div style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color }} />
    </div>
  );
}

export function Pips({ n, max }: { n: number; max: number }) {
  return (
    <div className="pips">
      {Array.from({ length: max }, (_, i) => (
        <div key={i} className={`pip ${i < n ? 'on' : ''}`} />
      ))}
    </div>
  );
}

/** Flow navigation used by the Play sequence: Character → Balloon → Workshop → Launch. */
export function FlowNext({ next, label }: { next: Screen; label: string }) {
  const setScreen = useGame((s) => s.setScreen);
  const prepareFlight = useGame((s) => s.prepareFlight);
  return (
    <Btn className="green" testId="flow-next" onClick={() => (next === 'prep' ? prepareFlight() : setScreen(next))}>
      {label} →
    </Btn>
  );
}
