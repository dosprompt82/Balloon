import { useGame } from '../../app/store';
import { ACHIEVEMENTS } from '../../data/achievements';
import { ScreenFrame } from '../ui';

export function Achievements() {
  const save = useGame((s) => s.save);
  const n = save.achievements.length;
  return (
    <ScreenFrame title={`Achievements ${n}/${ACHIEVEMENTS.length}`} wide testId="achievements-screen">
      <div className="grid cols4">
        {ACHIEVEMENTS.map((a) => {
          const got = save.achievements.includes(a.id);
          return (
            <div key={a.id} className={`card ${got ? '' : 'locked'}`} style={got ? { background: 'linear-gradient(135deg,#fffbe6,#fff0c2)' } : {}}>
              <div style={{ fontSize: 34, filter: got ? 'none' : 'grayscale(1)' }}>{a.icon}</div>
              <h3 style={{ fontSize: 16 }}>{a.name}</h3>
              <p>{a.description}</p>
              <div className="muted" style={{ fontWeight: 800, fontSize: 12 }}>{got ? '✓ Unlocked' : `Reward 🪙 ${a.reward}`}</div>
            </div>
          );
        })}
      </div>
    </ScreenFrame>
  );
}
