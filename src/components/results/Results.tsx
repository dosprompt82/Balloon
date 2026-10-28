import { useEffect, useState } from 'react';
import { useGame } from '../../app/store';
import { Btn, Bar } from '../ui';
import { fmt } from '../../game/core/math';
import { ZONES } from '../../data/zones';
import { ACHIEVEMENTS } from '../../data/achievements';
import { xpToNext } from '../../game/economy/rewards';
import { audio } from '../../game/audio/audio';
import { CHALLENGE_FLIGHTS } from '../../data/challenges';

const TITLES: Record<string, [string, string]> = {
  envelope: ['Balloon Destroyed!', 'The envelope gave out — but what a ride.'],
  basket: ['Basket Wrecked!', 'The crew bailed out with parachutes. Everyone is safe!'],
  crash: ['Crash Landing!', 'A bumpy return to earth. Ease off the vent next time.'],
  landing: ['Safe Landing!', 'Textbook touchdown. +25% bonus!'],
  fuel: ['Out of Fuel', 'You parachuted down safely from the silent balloon.'],
  abandoned: ['Flight Ended', 'You called it a day.'],
};

export function Results() {
  const { lastResult: r, save, prepareFlight, setScreen, flight } = useGame();
  const [shown, setShown] = useState(0);
  const [alt, setAlt] = useState(0);
  useEffect(() => {
    if (!r) return;
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / 1400);
      setAlt(r.maxAltitude * (1 - (1 - t) ** 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const iv = setInterval(() => {
      setShown((n) => {
        if (n < r.breakdown.length) audio.play('coin');
        return n + 1;
      });
    }, 220);
    if (r.newRecord) setTimeout(() => audio.play('record'), 900);
    if (r.levelAfter > r.levelBefore) setTimeout(() => audio.play('levelUp'), 1600);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(iv);
    };
  }, [r]);
  if (!r) return null;
  const [title, sub] = TITLES[r.endReason] ?? TITLES.abandoned;
  const total = r.breakdown.slice(0, shown).reduce((a, l) => a + l.coins, 0);
  const challenge = r.challengeId ? CHALLENGE_FLIGHTS.find((c) => c.id === r.challengeId) : null;
  const target = flight?.target;
  return (
    <div className="results">
      <div className="panel modal" data-testid="results">
        <h2 className="res-title">{title}</h2>
        <p style={{ textAlign: 'center', fontWeight: 700, marginTop: 4 }}>{sub}</p>
        <div className="res-alt" data-testid="result-altitude">{fmt(alt)} m</div>
        <div style={{ textAlign: 'center', fontWeight: 800, marginTop: 6 }}>
          {r.newRecord ? (
            <span className="newrecord">★ NEW PERSONAL BEST — previous {fmt(r.previousBest)} m ★</span>
          ) : r.previousBest > 0 ? (
            <span className="muted">Personal best: {fmt(Math.max(r.previousBest, r.maxAltitude))} m ({fmt(Math.max(0, r.previousBest - r.maxAltitude))} m to beat)</span>
          ) : (
            <span className="newrecord">First record set!</span>
          )}
          <div className="muted" style={{ marginTop: 4 }}>
            Reached zone {r.zoneReached + 1}: {ZONES[r.zoneReached].name} · {Math.floor(r.duration / 60)}m {Math.floor(r.duration % 60)}s
            {target ? ` · ${challenge ? challenge.name : 'Daily'} target ${fmt(target)} m ${r.maxAltitude >= target ? '✅' : '❌'}` : ''}
          </div>
        </div>
        <div className="grid cols4" style={{ marginTop: 12, textAlign: 'center' }}>
          <div className="card"><b>{r.disastersSurvived}</b><div className="sub">disasters survived</div></div>
          <div className="card"><b>{r.nearMisses}</b><div className="sub">near misses</div></div>
          <div className="card"><b>{r.coinsCollected}</b><div className="sub">coins collected</div></div>
          <div className="card"><b>{r.shards}</b><div className="sub">star shards</div></div>
        </div>
        <div className="label">Rewards</div>
        {r.breakdown.slice(0, shown).map((l, i) => (
          <div className="res-line" key={i}>
            <span>{l.label}</span>
            <span>🪙 +{fmt(l.coins)}</span>
          </div>
        ))}
        <div className="res-line" style={{ fontSize: 22, border: 'none' }}>
          <span>Total</span>
          <span data-testid="result-coins">🪙 {fmt(total)}</span>
        </div>
        <div className="row" style={{ fontWeight: 800 }}>
          <span>⭐ +{r.xpEarned} XP</span>
          <span className="spacer" />
          {r.levelAfter > r.levelBefore ? <span className="newrecord">LEVEL UP! {r.levelBefore} → {r.levelAfter}</span> : <span>Level {save.level}</span>}
        </div>
        <Bar value={save.xp} max={xpToNext(save.level)} color="linear-gradient(90deg,#4fc3f7,#a6f0ff)" />
        {r.unlockedAchievements.length > 0 && (
          <p style={{ fontWeight: 800 }}>🏆 {r.unlockedAchievements.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name).join(', ')}</p>
        )}
        <div className="row" style={{ marginTop: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Btn className="big green" testId="fly-again" onClick={() => prepareFlight(flight?.mode === 'normal' || !flight ? {} : { ...flight, seed: flight.mode === 'daily' ? flight.seed : undefined })}>
            🎈 Fly Again
          </Btn>
          <Btn className="blue" onClick={() => setScreen('upgrades')} testId="to-upgrades">🔧 Upgrades</Btn>
          <Btn className="ghost" onClick={() => setScreen('menu')} testId="to-menu">Main Menu</Btn>
        </div>
      </div>
    </div>
  );
}
