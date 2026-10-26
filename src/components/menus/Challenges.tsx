import { useGame } from '../../app/store';
import { CHALLENGE_FLIGHTS, MISSIONS, dailyChallenge } from '../../data/challenges';
import { Btn, ScreenFrame } from '../ui';
import { fmt } from '../../game/core/math';

function describeMods(m: Record<string, unknown>): string {
  const out: string[] = [];
  if (m.fuel) out.push(`Fuel ×${m.fuel}`);
  if (m.damage) out.push(`Damage ×${m.damage}`);
  if (m.disasterRate) out.push(`Disasters ×${m.disasterRate}`);
  if (m.intensity) out.push(`Intensity ×${m.intensity}`);
  if (m.coins) out.push(`Coins ×${m.coins}`);
  if (m.noFans) out.push('No fans');
  if (m.startAltitude) out.push(`Start at ${fmt(m.startAltitude as number)} m`);
  return out.join(' · ');
}

export function Challenges() {
  const { save, prepareFlight } = useGame();
  const daily = dailyChallenge(new Date());
  const dailyDone = save.dailyDone === daily.key;
  return (
    <ScreenFrame title="Challenges" wide testId="challenges-screen">
      <div className="card" style={{ background: 'linear-gradient(135deg,#fff7e0,#ffe0f0)' }}>
        <div className="row">
          <div style={{ flex: 1 }}>
            <div className="label" style={{ marginTop: 0 }}>Daily challenge · {daily.key}</div>
            <h3>☀ {daily.name}</h3>
            <p>
              Reach <b>{fmt(daily.target)} m</b> on today’s shared weather seed. {describeMods(daily.mods)}
            </p>
            <p className="muted">Reward: 🪙 {daily.reward} + 💎 {daily.shardReward} {dailyDone && '— ✅ completed today!'}</p>
          </div>
          <Btn className="big" testId="play-daily" onClick={() => prepareFlight({ mode: 'daily', seed: daily.seed, mods: daily.mods, target: daily.target, label: `Daily: ${daily.name}` })}>
            Fly
          </Btn>
        </div>
      </div>
      <div className="label">Challenge flights</div>
      <div className="grid cols3">
        {CHALLENGE_FLIGHTS.map((c) => {
          const done = save.challenges.includes(c.id);
          const ok = save.level >= c.level;
          return (
            <div key={c.id} className={`card ${ok ? '' : 'locked'}`}>
              {done && <span className="badge">✓</span>}
              <h3>{c.name}</h3>
              <p>{c.description}</p>
              <p className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{describeMods(c.mods)}</p>
              <p style={{ fontWeight: 800 }}>
                Goal: {fmt(c.target)} m · 🪙 {c.reward} 💎 {c.shardReward}
              </p>
              <Btn className="small purple" disabled={!ok} onClick={() => prepareFlight({ mode: 'challenge', challengeId: c.id, mods: c.mods, target: c.target, label: c.name })}>
                {ok ? 'Attempt' : `🔒 Level ${c.level}`}
              </Btn>
            </div>
          );
        })}
      </div>
      <div className="label">Missions (complete during any flight)</div>
      <div className="grid cols3">
        {MISSIONS.map((m) => {
          const done = save.missions.includes(m.id);
          return (
            <div key={m.id} className="card" style={done ? { background: '#e7fff5' } : {}}>
              {done && <span className="badge">✓</span>}
              <h3 style={{ fontSize: 16 }}>{m.name}</h3>
              <p>{m.description}</p>
              <p className="muted" style={{ fontWeight: 800 }}>🪙 {m.reward}</p>
            </div>
          );
        })}
      </div>
    </ScreenFrame>
  );
}
