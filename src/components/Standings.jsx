import { Trophy, TrendingUp, Minus } from 'lucide-react';

export default function Standings({ standings = [], format = 'season_long' }) {
  if (standings.length === 0) {
    return (
      <div className="card text-center py-10 text-clubhouse-500">
        No standings data yet. Scores will appear once a tournament completes.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full">
        <thead>
          <tr className="border-b border-clubhouse-800 bg-clubhouse-900/50">
            <th className="table-header w-12">#</th>
            <th className="table-header">Team</th>
            <th className="table-header text-right">Points</th>
            {format === 'head_to_head' && (
              <th className="table-header text-right">Record</th>
            )}
          </tr>
        </thead>
        <tbody>
          {standings.map((team, idx) => (
            <tr key={team.member_id}
              className={`border-b border-clubhouse-800/50 hover:bg-clubhouse-800/30 transition-colors
                ${idx === 0 ? 'bg-sand-900/10' : ''}`}>
              <td className="table-cell">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                  ${idx === 0 ? 'bg-sand-600 text-white' :
                    idx === 1 ? 'bg-clubhouse-500 text-white' :
                    idx === 2 ? 'bg-sand-800 text-sand-300' :
                    'bg-clubhouse-800 text-clubhouse-400'}`}>
                  {idx === 0 ? <Trophy size={12} /> : idx + 1}
                </div>
              </td>
              <td className="table-cell">
                <div>
                  <span className="font-semibold text-clubhouse-100">{team.team_name}</span>
                  <span className="text-xs text-clubhouse-500 ml-2">{team.display_name}</span>
                </div>
              </td>
              <td className="table-cell text-right">
                <span className="font-mono font-semibold text-fairway-400">
                  {Number(team.total_points).toFixed(0)}
                </span>
              </td>
              {format === 'head_to_head' && (
                <td className="table-cell text-right">
                  <span className="font-mono text-clubhouse-300">
                    {team.wins}-{team.losses}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
