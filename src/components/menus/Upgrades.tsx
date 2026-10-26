import { useState } from 'react';
import { useGame } from '../../app/store';
import { UPGRADES, type UpgradeCategory } from '../../data/upgrades';
import { Btn, FlowNext, Pips, ScreenFrame } from '../ui';
import { audio } from '../../game/audio/audio';
import { fmt } from '../../game/core/math';

const CATS: UpgradeCategory[] = ['Flight', 'Survival', 'Tools', 'Utility'];

export function Upgrades() {
  const { save, buyUpgrade, toast } = useGame();
  const [cat, setCat] = useState<UpgradeCategory>('Flight');
  return (
    <ScreenFrame title="Upgrade Workshop" wide testId="upgrades-screen" footer={<FlowNext next="prep" label="Launch Preparation" />}>
      <div className="tabs">
        {CATS.map((c) => (
          <button key={c} className={`tab ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="grid cols3">
        {UPGRADES.filter((u) => u.category === cat).map((u) => {
          const lvl = save.upgrades[u.id] ?? 0;
          const max = u.costs.length;
          const cost = u.costs[lvl];
          const levelOk = save.level >= u.requiredLevel;
          return (
            <div key={u.id} className={`card ${levelOk ? '' : 'locked'}`} data-testid={`upgrade-${u.id}`}>
              <h3>{u.name}</h3>
              <Pips n={lvl} max={max} />
              <p>{u.description}</p>
              <p style={{ fontWeight: 800, fontSize: 13 }}>
                {lvl > 0 ? <>Now: {u.levels[lvl - 1]}<br /></> : null}
                {lvl < max ? <>Next: {u.levels[lvl]}</> : 'MAXED OUT'}
              </p>
              {lvl < max && (
                <Btn
                  className="small green"
                  disabled={!levelOk || save.coins < cost}
                  testId={`buy-upgrade-${u.id}`}
                  onClick={() => {
                    if (buyUpgrade(u.id)) {
                      audio.play('purchase');
                      toast({ text: `${u.name} upgraded to level ${lvl + 1}!`, kind: 'good' }, 1600);
                    } else audio.play('error');
                  }}
                >
                  {levelOk ? `🪙 ${fmt(cost)}` : `🔒 Level ${u.requiredLevel}`}
                </Btn>
              )}
            </div>
          );
        })}
      </div>
    </ScreenFrame>
  );
}
