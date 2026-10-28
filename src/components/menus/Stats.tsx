import { useGame } from '../../app/store';
import { DISASTERS } from '../../data/disasters';
import { ScreenFrame } from '../ui';
import { fmt } from '../../game/core/math';
import { ZONES } from '../../data/zones';

const time = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${Math.floor(s % 60)}s`;

export function Stats() {
  const s = useGame((x) => x.save.stats);
  const rows: [string, string][] = [
    ['Flights', fmt(s.flights)],
    ['Highest altitude', `${fmt(s.bestAltitude)} m`],
    ['Highest zone', s.highestZone ? `${s.highestZone}. ${ZONES[s.highestZone - 1].name}` : '—'],
    ['Average altitude', `${fmt(s.flights ? s.totalAltitude / s.flights : 0)} m`],
    ['Total flight time', time(s.totalTime)],
    ['Longest flight', time(s.longestFlight)],
    ['Coins earned', fmt(s.totalCoins)],
    ['Disasters survived', fmt(s.disastersSurvived)],
    ['Near misses', fmt(s.nearMisses)],
    ['Hits taken', fmt(s.hits)],
    ['Repairs made', fmt(s.repairs)],
    ['Tools used', fmt(s.toolsUsed)],
    ['Lightning absorbed', fmt(s.lightningAbsorbed)],
    ['Safe landings', fmt(s.landings)],
    ['Crashes', fmt(s.crashes)],
    ['Star shards found', fmt(s.shardsFound)],
    ['Sky relics found', fmt(s.relicsFound)],
    ['Daily challenges', fmt(s.dailiesCompleted)],
  ];
  return (
    <ScreenFrame title="Statistics" testId="stats-screen">
      <table className="stats">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td>{k}</td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="label">Disasters survived by type</div>
      <table className="stats">
        <tbody>
          {DISASTERS.map((d) => (
            <tr key={d.id}>
              <td>
                {d.icon} {d.name}
              </td>
              <td>{s.disasterCounts[d.id] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScreenFrame>
  );
}
