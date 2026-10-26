import { useEffect, useRef } from 'react';
import { useGame } from './store';
import { mountEngine } from './engineHost';
import { MainMenu } from '../components/menus/MainMenu';
import { CharacterSelect } from '../components/menus/CharacterSelect';
import { Garage } from '../components/menus/Garage';
import { Upgrades } from '../components/menus/Upgrades';
import { Challenges } from '../components/menus/Challenges';
import { Achievements } from '../components/menus/Achievements';
import { Stats } from '../components/menus/Stats';
import { Settings } from '../components/menus/Settings';
import { HowToPlay } from '../components/menus/HowToPlay';
import { LaunchPrep } from '../components/menus/LaunchPrep';
import { Hud } from '../components/hud/Hud';
import { Results } from '../components/results/Results';
import { audio } from '../game/audio/audio';

function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind} ${t.big ? 'big' : ''}`}>
          {t.text}
          {t.sub && <div className="t-sub">{t.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const screen = useGame((s) => s.screen);
  useEffect(() => {
    if (host.current) mountEngine(host.current);
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
  return (
    <div className="game-root">
      <div className="canvas-host" ref={host} />
      <div className="ui-layer" data-screen={screen}>
        {screen === 'menu' && <MainMenu />}
        {screen === 'character' && <CharacterSelect />}
        {screen === 'garage' && <Garage />}
        {screen === 'upgrades' && <Upgrades />}
        {screen === 'challenges' && <Challenges />}
        {screen === 'achievements' && <Achievements />}
        {screen === 'stats' && <Stats />}
        {screen === 'settings' && <Settings />}
        {screen === 'howto' && <HowToPlay />}
        {screen === 'prep' && <LaunchPrep />}
        {screen === 'flight' && <Hud />}
        {screen === 'results' && <Results />}
        <Toasts />
      </div>
    </div>
  );
}
