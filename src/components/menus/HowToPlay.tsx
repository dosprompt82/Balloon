import { ScreenFrame } from '../ui';
import { ZONES } from '../../data/zones';
import { DISASTERS } from '../../data/disasters';
import { fmt } from '../../game/core/math';

export function HowToPlay() {
  return (
    <ScreenFrame title="How to Play" wide testId="howto-screen">
      <div className="grid cols2">
        <div className="card">
          <h3>🎯 Goal</h3>
          <p>Climb as high as you can. Every flight earns coins and XP — even when it ends in disaster. Spend them on upgrades and go higher next time.</p>
          <h3>🔥 Controls</h3>
          <p>
            <span className="kbd">W</span>/<span className="kbd">↑</span> burner — heats the air and slowly builds lift.<br />
            <span className="kbd">S</span>/<span className="kbd">↓</span> vent — releases hot air to sink.<br />
            <span className="kbd">A</span>/<span className="kbd">D</span> steer — weak until you buy Steering Fans.<br />
            <span className="kbd">Shift</span> emergency boost (burns 3× fuel).<br />
            <span className="kbd">Space</span> use tool · <span className="kbd">Q</span> switch tool · <span className="kbd">E</span> repair.<br />
            <span className="kbd">Tab</span> equipment · <span className="kbd">Esc</span> pause · mouse drag/wheel = camera.<br />
            <span className="kbd">F1</span> toggles the secret <b>Hyperion X</b> rocket balloon — absurdly fast, no fuel use, smashes through hazards.<br />
            <span className="kbd">F2</span> toggles <b>Insano X</b> — six afterburners, more than twice as fast as Hyperion.
          </p>
          <p>
            <b>Momentum matters:</b> the balloon keeps rising after you release the burner and takes a while to start sinking. Plan ahead!
          </p>
        </div>
        <div className="card">
          <h3>🌬 Wind layers</h3>
          <p>Each band of altitude has its own wind. Watch the wind gauge: climbing or sinking into a different layer is the main way to move sideways before you own good fans.</p>
          <h3>🧰 Survival</h3>
          <p>
            <b>Fuel</b> powers the burner — grab red canisters. <b>Envelope</b> and <b>basket</b> health end the flight at zero — press E to repair using materials (green kits).{' '}
            <b>Oxygen</b> drains above {fmt(6000)} m (blue bubbles refill it). <b>Cold</b> damages equipment and builds <b>ice</b>, which adds weight. Land gently (slow descent) for a +25% bonus.
          </p>
          <h3>⚠ Disasters</h3>
          <p>Every disaster is announced with a warning and a countdown. Read the tip, move early, and you’ll always have an escape. Surviving pays well!</p>
        </div>
      </div>
      <div className="label">Atmospheric zones</div>
      <div className="grid cols2">
        {ZONES.map((z) => (
          <div className="card" key={z.id} style={{ background: `linear-gradient(135deg, ${z.horizon}, ${z.zenith})`, color: z.id > 6 ? '#fff' : undefined }}>
            <h3>
              {z.id}. {z.name}
            </h3>
            <div className="sub">
              {fmt(z.min)} – {z.max === Infinity ? '∞' : fmt(z.max)} m
            </div>
            <p>
              {z.description} <b>{z.mechanic}.</b>
            </p>
          </div>
        ))}
      </div>
      <div className="label">Disaster field guide</div>
      <div className="grid cols3">
        {DISASTERS.map((d) => (
          <div className="card" key={d.id}>
            <h3>
              {d.icon} {d.name}
            </h3>
            <div className="sub">
              {fmt(d.minAlt)} m {d.maxAlt === Infinity ? '+' : `– ${fmt(d.maxAlt)} m`}
            </div>
            <p>{d.counter}</p>
          </div>
        ))}
      </div>
    </ScreenFrame>
  );
}
