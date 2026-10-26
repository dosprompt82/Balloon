import { useGame } from '../../app/store';
import { BALLOONS, balloonById } from '../../data/balloons';
import { Bar, Btn, FlowNext, ScreenFrame } from '../ui';
import { audio } from '../../game/audio/audio';
import { fmt } from '../../game/core/math';

function perks(mods: Record<string, number | undefined>): string[] {
  const out: string[] = [];
  const pct = (v: number) => `${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`;
  if (mods.lift) out.push(`Lift ${pct(mods.lift)}`);
  if (mods.steer) out.push(`Steering ${pct(mods.steer)}`);
  if (mods.fuelUse) out.push(`Fuel use ${pct(mods.fuelUse)}`);
  if (mods.damageTaken) out.push(`Damage taken ${pct(mods.damageTaken)}`);
  if (mods.coldResist) out.push(`Cold resist +${mods.coldResist}°`);
  if (mods.oxygenUse) out.push(`O₂ use ${pct(mods.oxygenUse)}`);
  if (mods.repairCost) out.push(`Repair cost ${pct(mods.repairCost)}`);
  if (mods.coinGain) out.push(`Coins ${pct(mods.coinGain)}`);
  if (mods.rareChance) out.push(`Rare finds ${pct(mods.rareChance)}`);
  return out;
}

export function Garage() {
  const { save, buyBalloon, selectBalloon, toast } = useGame();
  const sel = balloonById(save.selectedBalloon);
  return (
    <ScreenFrame title="Balloon Garage" testId="garage-screen" footer={<FlowNext next="upgrades" label="Upgrade Workshop" />}>
      <div className="grid cols2">
        {BALLOONS.map((b) => {
          const owned = save.ownedBalloons.includes(b.id);
          const levelOk = save.level >= b.level;
          const afford = save.coins >= b.cost && save.shards >= (b.shardCost ?? 0);
          return (
            <div key={b.id} data-testid={`balloon-${b.id}`} className={`card clickable ${save.selectedBalloon === b.id ? 'selected' : ''} ${owned ? '' : 'locked'}`} onClick={() => owned && selectBalloon(b.id)}>
              <div className="row">
                <svg width="46" height="56" viewBox="0 0 46 56">
                  <defs>
                    <linearGradient id={`g-${b.id}`} x1="0" x2="1">
                      {b.colors.map((c, i) => (
                        <stop key={i} offset={`${(i / Math.max(1, b.colors.length - 1)) * 100}%`} stopColor={c} />
                      ))}
                    </linearGradient>
                  </defs>
                  <path d="M23 2 C40 2 44 16 42 24 C40 32 30 38 27 44 L19 44 C16 38 6 32 4 24 C2 16 6 2 23 2 Z" fill={`url(#g-${b.id})`} stroke="#0003" />
                  <rect x="17" y="47" width="12" height="8" rx="2" fill="#8a5a2b" />
                </svg>
                <div style={{ flex: 1 }}>
                  <h3>{b.name}</h3>
                  <div className="sub">{b.description}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, marginTop: 6 }}>
                Envelope {b.envelopeHp} <Bar value={b.envelopeHp} max={170} color="#ff6b4a" />
                Basket {b.basketHp} <Bar value={b.basketHp} max={145} color="#f4a261" />
                Fuel {b.fuelCapacity} <Bar value={b.fuelCapacity} max={145} color="#ef476f" />
              </div>
              <div className="chips" style={{ marginTop: 6 }}>
                {perks(b.modifiers as Record<string, number>).map((p) => (
                  <span key={p} className="chip" style={{ fontSize: 11 }}>{p}</span>
                ))}
              </div>
              <div style={{ marginTop: 8 }}>
                {owned ? (
                  save.selectedBalloon === b.id ? <span className="badge">FLYING</span> : <span className="badge" style={{ background: '#3fa7d6' }}>OWNED</span>
                ) : (
                  <Btn
                    className="small"
                    disabled={!levelOk || !afford}
                    testId={`buy-${b.id}`}
                    onClick={() => {
                      if (buyBalloon(b.id)) {
                        audio.play('purchase');
                        toast({ text: `${b.name} is yours!`, kind: 'good' });
                      }
                    }}
                  >
                    {!levelOk ? `🔒 Level ${b.level}` : `Buy 🪙 ${fmt(b.cost)}${b.shardCost ? ` + 💎${b.shardCost}` : ''}`}
                  </Btn>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="muted" style={{ fontWeight: 700 }}>Currently flying: {sel.name}. Click an owned balloon to fly it.</p>
    </ScreenFrame>
  );
}
