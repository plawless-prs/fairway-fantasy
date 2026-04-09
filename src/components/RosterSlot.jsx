import { getFlag } from '../lib/constants';
import { ArrowUpDown, UserMinus } from 'lucide-react';

export default function RosterSlot({ roster, slotLabel, onDrop, onMove, editable = false }) {
  const golfer = roster?.golfers;

  if (!golfer) {
    return (
      <div className="flex items-center gap-4 px-4 py-3 rounded-xl border-2 border-dashed border-clubhouse-800 bg-clubhouse-900/30">
        <div className="w-10 h-10 rounded-lg bg-clubhouse-800/50 flex items-center justify-center">
          <span className="text-clubhouse-600 text-lg">?</span>
        </div>
        <div>
          <span className="text-sm text-clubhouse-500 italic">Empty {slotLabel} Slot</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-clubhouse-900/60 border border-clubhouse-800 hover:border-clubhouse-600 transition-colors group">
      {/* Rank */}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono text-sm font-bold shrink-0
        ${golfer.owgr_rank <= 10 ? 'bg-sand-700/30 text-sand-300' :
          golfer.owgr_rank <= 25 ? 'bg-fairway-800/40 text-fairway-300' :
          'bg-clubhouse-800 text-clubhouse-400'}`}>
        {golfer.owgr_rank}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span>{getFlag(golfer.country)}</span>
          <span className="font-semibold text-clubhouse-100 truncate">{golfer.name}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium
            ${roster.slot_type === 'starter' ? 'bg-fairway-900/40 text-fairway-400' : 'bg-clubhouse-800 text-clubhouse-500'}`}>
            {roster.slot_type === 'starter' ? 'Starter' : 'Bench'}
          </span>
          <span className="text-xs text-clubhouse-500">{golfer.country}</span>
        </div>
      </div>

      {/* Actions */}
      {editable && (
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => onMove?.(roster)}
            className="p-2 rounded-lg text-clubhouse-400 hover:text-sand-300 hover:bg-clubhouse-800 transition-colors"
            title={roster.slot_type === 'starter' ? 'Move to Bench' : 'Move to Starter'}>
            <ArrowUpDown size={14} />
          </button>
          <button onClick={() => onDrop?.(roster)}
            className="p-2 rounded-lg text-clubhouse-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"
            title="Drop Player">
            <UserMinus size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
