import { useEffect, useState } from 'react';
import { useGame, currentLoadout } from '../../app/store';
import { Btn, ScreenFrame } from '../ui';
import { DISASTERS } from '../../data/disasters';
import { toolById } from '../../data/tools';
import { fmt } from '../../game/core/math';
import { audio } from '../../game/audio/audio';

const TOD_NAMES = ['Sunrise', 'Early morning', 'Late morning', 'Noon', 'Afternoon', 'Golden hour'];

export function LaunchPrep() {
  const { save, flight, launch, setScreen } = useGame();
  const [count, setCount] = useState(0);
  const lo = currentLoadout(save, flight?.mods);
  const seed = flight?.seed ?? 0;
  const startAlt = lo.flight.startAltitude;
  const early = DISASTERS.filter((d) => d.minAlt <= startAlt + 6000 && d.maxAlt >= startAlt);

  useEffect(() => {
    if (count <= 0) return;
    audio.play(count === 1 ? 'launch' : 'click');
    const t = setTimeout(() => {
      if (count === 1) launch();
      setCount(count - 1);
    }, 650);
    return () => clearTimeout(t);
  }, [count, launch]);

  return (
    <>
      <ScreenFrame
        title="Launch Preparation"
        testId="prep-screen"
        footer={
          <>
            <Btn className="ghost small" onClick={() => setScreen('character')}>Pilot</Btn>
            <Btn className="ghost small" onClick={() => setScreen('garage')}>Balloon</Btn>
            <Btn className="ghost small" onClick={() => setScreen('upgrades')}>Upgrades</Btn>
            <span className="spacer" />
            <Btn className="big green" testId="launch" onClick={() => count === 0 && setCount(3)}>
              🎈 LAUNCH
            </Btn>
          </>
        }
      >
        <div className="card">
          <h3>{flight?.label ?? 'Free Flight'}</h3>
          <div className="sub">
            Flight seed #{seed.toString(16).toUpperCase()} · Launch at {TOD_NAMES[seed % 6]}
            {startAlt > 0 && ` · starting at ${fmt(startAlt)} m`}
            {flight?.target ? ` · target ${fmt(flight.target)} m` : ''}
          </div>
        </div>
        <div className="grid cols2" style={{ marginTop: 10 }}>
          <div className="card">
            <h3>{lo.character.name}</h3>
            <div className="sub">{lo.character.title}</div>
            <p>{lo.character.abilityDetail}</p>
          </div>
          <div className="card">
            <h3>{lo.balloon.name}</h3>
            <div className="sub">{lo.balloon.description}</div>
          </div>
        </div>
        <div className="label">Flight systems</div>
        <table className="stats">
          <tbody>
            <tr><td>Envelope / Basket</td><td>{Math.round(lo.maxEnvelope)} / {Math.round(lo.maxBasket)} HP</td></tr>
            <tr><td>Fuel capacity</td><td>{Math.round(lo.maxFuel)}</td></tr>
            <tr><td>Oxygen supply</td><td>{Math.round(lo.maxOxygen)}</td></tr>
            <tr><td>Burner power</td><td>{Math.round(lo.burnerMult * 100)}%</td></tr>
            <tr><td>Steering</td><td>{lo.flight.noFans ? 'Fans disabled!' : `${lo.steerAccel.toFixed(1)} thrust`}</td></tr>
            <tr><td>Cold resistance</td><td>+{Math.round(lo.coldResist)}°</td></tr>
            <tr><td>Repair materials</td><td>{lo.repairMaterials}</td></tr>
            <tr><td>Tools</td><td>{Object.entries(lo.tools).map(([id, n]) => `${toolById(id as never).icon}×${n}`).join('  ') || 'None'}</td></tr>
          </tbody>
        </table>
        <div className="label">Weather forecast</div>
        <p style={{ fontWeight: 700 }}>
          Expected early hazards: {early.slice(0, 6).map((d) => `${d.icon} ${d.name}`).join(', ') || 'clear skies'}. Disasters grow fiercer the higher you climb.
        </p>
      </ScreenFrame>
      {count > 0 && <div className="countdown" key={count}>{count}</div>}
    </>
  );
}
