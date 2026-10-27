import { useGame } from '../../app/store';
import { Btn } from '../ui';
import { characterById } from '../../data/characters';
import { balloonById } from '../../data/balloons';
import { fmt } from '../../game/core/math';
import { zoneAt } from '../../data/zones';
import { xpToNext } from '../../game/economy/rewards';

export function MainMenu() {
  const { save, setScreen } = useGame();
  const special = useGame((s) => s.special);
  const ch = characterById(save.selectedCharacter);
  const bl = balloonById(save.selectedBalloon);
  const play = () => (save.hasPicked ? useGame.getState().prepareFlight() : setScreen('character'));
  return (
    <>
      <div className="title-wrap">
        <h1 className="title">SKYBOUND</h1>
        <div className="subtitle">ABOVE THE STORM</div>
      </div>
      <div className="menu-left" data-testid="main-menu">
        <Btn className="big" onClick={play} testId="play">
          ▶ Play
        </Btn>
        <Btn className="blue" onClick={() => setScreen('character')} testId="menu-character">🧑‍🚀 Character</Btn>
        <Btn className="blue" onClick={() => setScreen('garage')} testId="menu-garage">🎈 Balloon Garage</Btn>
        <Btn className="blue" onClick={() => setScreen('upgrades')} testId="menu-upgrades">🔧 Upgrades</Btn>
        <div className="row">
          <Btn className="purple small" onClick={() => setScreen('challenges')} testId="menu-challenges">🏁 Challenges</Btn>
          <Btn className="purple small" onClick={() => setScreen('achievements')} testId="menu-achievements">🏆 Achievements</Btn>
        </div>
        <div className="row">
          <Btn className="ghost small" onClick={() => setScreen('stats')} testId="menu-stats">📊 Statistics</Btn>
          <Btn className="ghost small" onClick={() => setScreen('settings')} testId="menu-settings">⚙ Settings</Btn>
          <Btn className="ghost small" onClick={() => setScreen('howto')} testId="menu-howto">❓ How to Play</Btn>
        </div>
      </div>
      <div className="panel menu-right">
        <div className="label" style={{ marginTop: 0 }}>Highest altitude</div>
        <div className="record-big" data-testid="best-altitude">{fmt(save.stats.bestAltitude)} m</div>
        <div className="muted" style={{ fontWeight: 800, fontSize: 13 }}>{save.stats.bestAltitude > 0 ? zoneAt(save.stats.bestAltitude).name : 'Not yet flown'}</div>
        <div className="label">Pilot</div>
        <div className="stat-line"><span>Level {save.level}</span><span>{save.xp} / {xpToNext(save.level)} XP</span></div>
        <div className="stat-line"><span>🪙 Coins</span><span>{fmt(save.coins)}</span></div>
        <div className="stat-line"><span>💎 Star shards</span><span>{save.shards}</span></div>
        <div className="stat-line"><span>Character</span><span>{ch.name}</span></div>
        <div className="stat-line"><span>Balloon</span><span>{special === 'insano' ? 'INSANO X 🔥' : special === 'hyper' ? 'HYPERION X 🚀' : bl.name}</span></div>
        <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginTop: 8 }}>Psst… press <span className="kbd">F1</span> or <span className="kbd">F2</span></div>
      </div>
    </>
  );
}
