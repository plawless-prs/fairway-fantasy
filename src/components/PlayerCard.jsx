import { getFlag } from '../lib/constants';
import { UserPlus, UserMinus, ArrowUpDown } from 'lucide-react';

export default function PlayerCard({ golfer, actions = [], compact = false }) {
  if (!golfer) return null;

  const flag = getFlag(golfer.country);

  if (compact) {
    return (
      <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-clubhouse-800/50 transition-colors group">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-clubhouse-500 w-6 text-right">
            #{golfer.owgr_rank}
          </span>
          <span className="text-sm">{flag}</span>
          <span className="text-sm font-medium text-clubhouse-200">{golfer.name}</span>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {actions.map((action, i) => (
            <button key={i} onClick={action.onClick}
              className={`p-1.5 rounded-md text-xs transition-colors ${action.className || 'text-clubhouse-400 hover:text-white hover:bg-clubhouse-700'}`}
              title={action.label}>
              {action.icon}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card-hover flex items-center gap-4">
      {/* Rank badge */}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono text-sm font-bold shrink-0
        ${golfer.owgr_rank <= 10 ? 'bg-sand-700/30 text-sand-300 border border-sand-700/40' :
          golfer.owgr_rank <= 25 ? 'bg-fairway-800/40 text-fairway-300 border border-fairway-700/40' :
          'bg-clubhouse-800 text-clubhouse-400 border border-clubhouse-700'}`}>
        {golfer.owgr_rank}
      </div>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-base">{flag}</span>
          <span className="font-semibold text-clubhouse-100 truncate">{golfer.name}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-clubhouse-500">{golfer.country}</span>
          {golfer.avg_score && (
            <span className={`text-xs font-mono ${golfer.avg_score < 0 ? 'text-fairway-400' : 'text-red-400'}`}>
              {golfer.avg_score > 0 ? '+' : ''}{golfer.avg_score}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          {actions.map((action, i) => (
            <button key={i} onClick={action.onClick}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${action.variant === 'add' ? 'btn-primary text-xs px-3 py-1.5' :
                  action.variant === 'drop' ? 'btn-danger text-xs px-3 py-1.5' :
                  'btn-secondary text-xs px-3 py-1.5'}`}>
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PlayerCardSkeleton() {
  return (
    <div className="card flex items-center gap-4 animate-pulse">
      <div className="w-10 h-10 rounded-lg bg-clubhouse-800" />
      <div className="flex-1">
        <div className="h-4 w-32 bg-clubhouse-800 rounded" />
        <div className="h-3 w-20 bg-clubhouse-800 rounded mt-2" />
      </div>
    </div>
  );
}
