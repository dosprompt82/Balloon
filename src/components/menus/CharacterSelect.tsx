import { useGame, isCharacterUnlocked, lookFor } from '../../app/store';
import { CHARACTERS, characterById } from '../../data/characters';
import { ACCESSORIES, OUTFIT_COLORS } from '../../data/cosmetics';
import { Btn, FlowNext, ScreenFrame } from '../ui';

export function CharacterSelect() {
  const { save, selectCharacter, customize, buyAccessory, toast } = useGame();
  const sel = characterById(save.selectedCharacter);
  const look = lookFor(save, sel);
  return (
    <ScreenFrame title="Choose Your Pilot" testId="character-screen" footer={<FlowNext next="garage" label="Choose Balloon" />}>
      <div className="grid cols4">
        {CHARACTERS.map((c) => {
          const unlocked = isCharacterUnlocked(save, c);
          return (
            <div
              key={c.id}
              data-testid={`char-${c.id}`}
              className={`card clickable ${save.selectedCharacter === c.id ? 'selected' : ''} ${unlocked ? '' : 'locked'}`}
              onClick={() => (unlocked ? selectCharacter(c.id) : toast({ text: c.unlock!.text, kind: 'warn' }))}
            >
              <Portrait shirt={c.shirt} skin={c.skin} hair={c.hair} />
              <h3 style={{ fontSize: 15 }}>{c.name}</h3>
              <div className="sub">{c.title}</div>
              {!unlocked && <span className="badge lock">🔒</span>}
            </div>
          );
        })}
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h3>
          {sel.name} — {sel.title}
        </h3>
        <p>
          <b>{sel.ability}:</b> {sel.abilityDetail}
        </p>
        <div className="label">Shirt colour</div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {OUTFIT_COLORS.map((o) => (
            <div
              key={o.color}
              title={o.level > save.level ? `Unlocks at level ${o.level}` : ''}
              className={`swatch ${look.shirt === o.color ? 'on' : ''} ${o.level > save.level ? 'locked' : ''}`}
              style={{ background: o.color }}
              onClick={() => o.level <= save.level && customize(sel.id, { shirt: o.color })}
            />
          ))}
        </div>
        <div className="label">Trousers colour</div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {OUTFIT_COLORS.map((o) => (
            <div
              key={o.color}
              className={`swatch ${look.pants === o.color ? 'on' : ''} ${o.level > save.level ? 'locked' : ''}`}
              style={{ background: o.color }}
              onClick={() => o.level <= save.level && customize(sel.id, { pants: o.color })}
            />
          ))}
        </div>
        <div className="label">Accessory</div>
        <div className="chips">
          {ACCESSORIES.map((a) => {
            const levelOk = save.level >= a.level;
            const owned = !a.shardCost || save.ownedAccessories.includes(a.id);
            const on = look.accessory === a.id;
            return (
              <button
                key={a.id}
                className="tab"
                style={on ? { background: '#ff6b4a', color: '#fff' } : levelOk ? {} : { opacity: 0.45 }}
                onClick={() => {
                  if (!levelOk) return toast({ text: `${a.name} unlocks at level ${a.level}`, kind: 'warn' });
                  if (!owned) {
                    if (buyAccessory(a.id)) toast({ text: `${a.name} unlocked!`, kind: 'good' });
                    else return toast({ text: `Needs ${a.shardCost} 💎 star shards`, kind: 'warn' });
                  }
                  customize(sel.id, { accessory: a.id });
                }}
              >
                {a.name}
                {!levelOk ? ` 🔒${a.level}` : !owned ? ` 💎${a.shardCost}` : ''}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 10 }}>
          <Btn className="ghost small" onClick={() => customize(sel.id, { shirt: sel.shirt, pants: sel.pants, accessory: sel.defaultAccessory })}>
            Reset look
          </Btn>
        </div>
      </div>
    </ScreenFrame>
  );
}

function Portrait({ shirt, skin, hair }: { shirt: string; skin: string; hair: string }) {
  return (
    <svg viewBox="0 0 60 60" width="100%" height="64" style={{ display: 'block' }}>
      <rect x="0" y="0" width="60" height="60" rx="12" fill="#e6f4ff" />
      <path d="M12 60 Q12 40 30 40 Q48 40 48 60 Z" fill={shirt} />
      <circle cx="30" cy="27" r="13" fill={skin} />
      <path d="M17 25 Q18 11 30 12 Q43 11 43 25 Q38 17 30 18 Q22 17 17 25 Z" fill={hair} />
      <circle cx="25" cy="28" r="2" fill="#1b1b1e" />
      <circle cx="35" cy="28" r="2" fill="#1b1b1e" />
      <path d="M25 33 Q30 37 35 33" stroke="#6b2737" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
