import { useEffect, useRef } from 'react';
import { useGame, type HudSnapshot } from '../../app/store';
import { ZONES } from '../../data/zones';
import { INTENSITY_NAMES } from '../../data/config';
import { toolById } from '../../data/tools';
import { fmt } from '../../game/core/math';
import { Bar } from '../ui';

/** Smoothly animated altitude counter (interpolates between HUD snapshots every animation frame). */
function AltitudeNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const target = useRef(value);
  target.current = value;
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      shown.current += (target.current - shown.current) * 0.18;
      if (Math.abs(target.current - shown.current) < 0.5) shown.current = target.current;
      if (ref.current) ref.current.textContent = fmt(shown.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <span ref={ref} data-testid="altitude">{fmt(value)}</span>;
}

function AltitudeMeter({ h }: { h: HudSnapshot }) {
  const near = h.best > 0 && !h.recordBroken && h.altitude > h.best * 0.85;
  const climb = h.climbRate;
  return (
    <>
      <div className={`alt-meter ${h.recordBroken ? 'record' : near ? 'near' : ''}`}>
        <div className="alt-label">{h.recordBroken ? '★ NEW PERSONAL BEST ★' : 'ALTITUDE'}</div>
        <div className="alt-value">
          <AltitudeNumber value={h.altitude} />
          <small>m</small>
        </div>
        <div className="alt-sub">
          <span>BEST {fmt(Math.max(h.best, h.recordBroken ? h.maxAltitude : 0))} m</span>
          <span className={`climb ${climb > 0.5 ? 'up' : climb < -0.5 ? 'down' : ''}`}>
            {climb >= 0 ? '▲' : '▼'} {fmt(Math.abs(climb))} m/s
          </span>
          <span>NEXT {fmt(h.nextMilestone)} m</span>
        </div>
      </div>
      <div className="zone-name">
        ZONE {ZONES[h.zoneIndex].id} · {ZONES[h.zoneIndex].name.toUpperCase()}
      </div>
    </>
  );
}

const LADDER_MAX_ZONES = 10;
function AltitudeLadder({ h }: { h: HudSnapshot }) {
  // logarithmic so every zone gets readable space
  const pos = (a: number) => Math.min(1, Math.log10(1 + a / 200) / Math.log10(1 + 200000 / 200));
  const marks = [0, 1000, 3000, 6000, 10000, 15000, 22000, 35000, 60000, 100000, 200000];
  return (
    <div className="alt-ladder">
      <div className="track">
        {ZONES.slice(0, LADDER_MAX_ZONES).map((z) => (
          <div key={z.id} className="seg" style={{ bottom: `${pos(z.min) * 100}%`, height: `${(pos(z.max === Infinity ? 200000 : z.max) - pos(z.min)) * 100}%`, background: `linear-gradient(0deg, ${z.horizon}, ${z.zenith})` }} />
        ))}
      </div>
      {marks.slice(1).map((m) => (
        <div key={m} className="tick" style={{ bottom: `${pos(m) * 100}%`, opacity: m === h.nextMilestone ? 1 : 0.7 }}>
          {m >= 1000 ? `${m / 1000}k` : m}
        </div>
      ))}
      {h.best > 0 && <div className="best" style={{ bottom: `${pos(h.best) * 100}%` }} title="Personal best" />}
      <div className="me" style={{ bottom: `${pos(h.altitude) * 100}%` }} />
    </div>
  );
}

function Gauge({ label, value, max, color, text, crit }: { label: string; value: number; max: number; color: string; text?: string; crit?: boolean }) {
  return (
    <div className={`gauge ${crit ? 'crit' : ''}`}>
      <div className="g-head">
        <span>{label}</span>
        <span>{text ?? `${Math.round((value / max) * 100)}%`}</span>
      </div>
      <Bar value={value} max={max} color={color} />
    </div>
  );
}

function Gauges({ h }: { h: HudSnapshot }) {
  const windDir = h.wind >= 0 ? 0 : 180;
  return (
    <div className="gauges" data-testid="gauges">
      <Gauge label="⛽ FUEL" value={h.fuel} max={h.maxFuel} color="linear-gradient(90deg,#ff4d6d,#ff9f1c)" crit={h.fuel < h.maxFuel * 0.2} />
      <Gauge label="🎈 BALLOON" value={h.envelope} max={h.maxEnvelope} color="linear-gradient(90deg,#ff6b4a,#ffd166)" text={`${Math.round(h.envelope)}`} crit={h.envelope < h.maxEnvelope * 0.3} />
      <Gauge label="🧺 BASKET" value={h.basket} max={h.maxBasket} color="linear-gradient(90deg,#c8813a,#f4c27a)" text={`${Math.round(h.basket)}`} crit={h.basket < h.maxBasket * 0.3} />
      <Gauge label="🫧 OXYGEN" value={h.oxygen} max={h.maxOxygen} color="linear-gradient(90deg,#4cc9f0,#a0e9ff)" crit={h.needsO2 && h.oxygen < h.maxOxygen * 0.25} text={h.needsO2 ? undefined : 'open air'} />
      <Gauge label="⚙ EQUIPMENT" value={h.equipment} max={100} color="linear-gradient(90deg,#8d99ae,#edf2f4)" crit={h.equipment < 30} />
      <Gauge label="🔥 ENVELOPE HEAT" value={h.heat} max={2.6} color="linear-gradient(90deg,#ffb347,#ff3d00)" text={h.burning ? 'BURNING' : h.venting ? 'VENTING' : ''} />
      {h.ice > 0.05 && <Gauge label="❄ ICE LOAD" value={h.ice} max={1.5} color="linear-gradient(90deg,#bde0fe,#ffffff)" crit={h.ice > 0.7} />}
      <div className="wind-row">
        <span>🌡 {Math.round(h.temp)}°C</span>
        <span className="spacer" />
        <span>WIND</span>
        <span className="wind-arrow" style={{ transform: `rotate(${windDir}deg)` }}>➜</span>
        <span>{Math.round(Math.abs(h.wind))} km/h</span>
      </div>
    </div>
  );
}

function Warnings({ h }: { h: HudSnapshot }) {
  const w = h.warnings[0];
  if (!w || w.phase === 'done') return null;
  const ending = w.phase === 'ending';
  return (
    <div className={`warning-box ${w.phase === 'warning' ? 'warning' : ''}`} style={{ borderColor: w.color, background: ending ? 'rgba(10,80,60,0.5)' : undefined }} data-testid="warning">
      <div className="w-title" style={{ color: w.color }}>
        {w.icon} {ending ? 'CLEARING' : w.phase === 'warning' ? 'INCOMING' : 'ACTIVE'}: {INTENSITY_NAMES[w.intensity].toUpperCase()} {w.name.toUpperCase()}
        {!ending && ` · ${Math.ceil(w.countdown)}s`}
      </div>
      {w.phase === 'warning' && <div className="w-sub" style={{ fontSize: 15 }}>{w.warning}</div>}
      <div className="w-sub">💡 {w.counter}</div>
      {h.warnings[1] && (
        <div className="w-sub" style={{ color: h.warnings[1].color }}>
          + {h.warnings[1].icon} {h.warnings[1].name} ({h.warnings[1].phase})
        </div>
      )}
    </div>
  );
}

function ToolBar({ h }: { h: HudSnapshot }) {
  return (
    <div className="toolbar">
      {h.tools.map((t) => {
        const def = toolById(t.id);
        const active = (t.id === 'shield' && h.shield > 0) || (t.id === 'lightningRod' && h.rod > 0);
        return (
          <div key={t.id} className={`tool ${h.currentTool === t.id ? 'on' : ''} ${t.charges === 0 ? 'empty' : ''}`} style={active ? { boxShadow: '0 0 20px #7df9ff' } : {}}>
            <span className="ico">{def.icon}</span>
            <span className="nm">{def.name.toUpperCase()}</span>
            <span className="ch">{t.charges}</span>
            {h.currentTool === t.id && <span className="keyhint">SPACE</span>}
          </div>
        );
      })}
      <div className="tool" title="Repair (E)">
        <span className="ico">🔧</span>
        <span className="nm">REPAIR</span>
        <span className="ch" style={{ background: h.materials >= h.repairCost ? '#06d6a0' : '#6c757d' }}>{h.materials}</span>
        <span className="keyhint">E</span>
      </div>
    </div>
  );
}

function Hint({ h }: { h: HudSnapshot }) {
  const { settings } = useGame((s) => s.save);
  const flights = useGame((s) => s.save.stats.flights);
  if (!settings.showHints || flights > 3) return null;
  let text: React.ReactNode = null;
  if (h.time < 7 && h.altitude < 20) text = <>Hold <span className="kbd">W</span> to fire the burner — the balloon needs a moment to heat up!</>;
  else if (h.time < 20 && h.altitude > 30 && h.altitude < 250) text = <>Release <span className="kbd">W</span> early — momentum keeps you rising. <span className="kbd">A</span>/<span className="kbd">D</span> to steer.</>;
  else if (h.envelope < h.maxEnvelope * 0.6 && h.materials >= h.repairCost) text = <>Press <span className="kbd">E</span> to patch the balloon.</>;
  else if (h.fuel < h.maxFuel * 0.3) text = <>Fuel low! Fly into red ⛽ canisters.</>;
  else if (h.warnings[0]?.phase === 'warning') text = <>Read the warning and move early — every disaster has an escape.</>;
  if (!text) return null;
  return <div className="hint">{text}</div>;
}

function PauseMenu() {
  const { setPaused, quitFlight, setScreen } = useGame();
  return (
    <div className="overlay-center">
      <div className="panel modal" style={{ textAlign: 'center' }} data-testid="pause-menu">
        <h2 style={{ marginTop: 0, fontSize: 34 }}>Paused</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn green" onClick={() => setPaused(false)}>Resume</button>
          <button className="btn blue" onClick={() => { setPaused(false); quitFlight(); }}>End flight & collect rewards</button>
          <button className="btn ghost" onClick={() => { setPaused(false); quitFlight(); setTimeout(() => setScreen('settings'), 1000); }}>End & open settings</button>
        </div>
        <p className="muted" style={{ fontWeight: 700 }}>Esc to resume</p>
      </div>
    </div>
  );
}

function EquipmentPanel({ h }: { h: HudSnapshot }) {
  const setEquipmentOpen = useGame((s) => s.setEquipmentOpen);
  return (
    <div className="overlay-center" onClick={() => setEquipmentOpen(false)}>
      <div className="panel modal" style={{ minWidth: 420 }}>
        <h2 style={{ marginTop: 0 }}>Equipment</h2>
        <table className="stats">
          <tbody>
            <tr><td>Envelope</td><td>{Math.round(h.envelope)} / {Math.round(h.maxEnvelope)}</td></tr>
            <tr><td>Basket</td><td>{Math.round(h.basket)} / {Math.round(h.maxBasket)}</td></tr>
            <tr><td>Fuel</td><td>{Math.round(h.fuel)} / {Math.round(h.maxFuel)}</td></tr>
            <tr><td>Oxygen</td><td>{Math.round(h.oxygen)} / {Math.round(h.maxOxygen)}</td></tr>
            <tr><td>Equipment condition</td><td>{Math.round(h.equipment)}%</td></tr>
            <tr><td>Ice load</td><td>{Math.round(h.ice * 100)}%</td></tr>
            <tr><td>Cabin / outside temp</td><td>{Math.round(h.temp)}° / {Math.round(h.ambient)}°C</td></tr>
            <tr><td>Repair materials</td><td>{h.materials} (each repair uses {h.repairCost})</td></tr>
            {h.tools.map((t) => (
              <tr key={t.id}><td>{toolById(t.id).icon} {toolById(t.id).name} — {toolById(t.id).description}</td><td>{t.charges} left</td></tr>
            ))}
            <tr><td>Coins this flight</td><td>🪙 {fmt(h.coins)}</td></tr>
          </tbody>
        </table>
        <p className="muted" style={{ fontWeight: 700 }}>Tab or click to close</p>
      </div>
    </div>
  );
}

export function Hud() {
  const h = useGame((s) => s.hud);
  const paused = useGame((s) => s.paused);
  const equip = useGame((s) => s.equipmentOpen);
  const hyper = useGame((s) => s.hyper);
  if (!h) return null;
  const hurt = Math.min(h.envelope / h.maxEnvelope, h.basket / h.maxBasket);
  const vignette = h.hypoxic ? 'inset 0 0 160px 60px rgba(40,0,80,0.7)' : hurt < 0.3 ? `inset 0 0 140px 40px rgba(200,0,30,${0.35 + 0.2 * Math.sin(h.time * 6)})` : h.temp < -20 ? 'inset 0 0 140px 30px rgba(170,220,255,0.35)' : 'none';
  return (
    <div className="hud" data-testid="hud">
      <div className="vignette" style={{ boxShadow: vignette }} />
      <AltitudeMeter h={h} />
      <AltitudeLadder h={h} />
      <Gauges h={h} />
      <div className="coins-run" style={{ left: 74 }}>🪙 {fmt(h.coins)}</div>
      <Warnings h={h} />
      <ToolBar h={h} />
      {h.repairing > 0 && (
        <div className="repair-box">
          🔧 Repairing…
          <Bar value={h.repairing} max={1} color="#06d6a0" />
        </div>
      )}
      {h.noFuel && !h.dying && <div className="hint" style={{ background: '#ffe0e6' }}>Out of fuel! Find a canister or press <span className="kbd">Enter</span> to parachute down.</div>}
      {!h.noFuel && <Hint h={h} />}
      <div className="status-row">
        {hyper && <span className="status-pill" style={{ background: 'linear-gradient(90deg,#ff006e,#8338ec,#3a86ff)' }}>🚀 HYPERION X · F1</span>}
        {h.shield > 0 && <span className="status-pill">◯ Shield {Math.ceil(h.shield)}s</span>}
        {h.rod > 0 && <span className="status-pill">⚡ Rod {Math.ceil(h.rod)}s</span>}
        {h.hypoxic && <span className="status-pill" style={{ background: '#5a189a' }}>NO OXYGEN</span>}
        <span className="status-pill">⏱ {Math.floor(h.time / 60)}:{String(Math.floor(h.time % 60)).padStart(2, '0')}</span>
      </div>
      <div style={{ pointerEvents: 'auto' }}>
        {paused && <PauseMenu />}
        {equip && !paused && <EquipmentPanel h={h} />}
      </div>
    </div>
  );
}
