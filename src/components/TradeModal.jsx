import { useState } from 'react';
import { X, ArrowLeftRight, Send } from 'lucide-react';
import PlayerCard from './PlayerCard';

export default function TradeModal({ isOpen, onClose, myRoster = [], theirRoster = [], theirTeamName, onSubmit }) {
  const [myOffers, setMyOffers] = useState([]);
  const [theirOffers, setTheirOffers] = useState([]);
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const toggleMyOffer = (golferId) => {
    setMyOffers(prev =>
      prev.includes(golferId) ? prev.filter(id => id !== golferId) : [...prev, golferId]
    );
  };

  const toggleTheirOffer = (golferId) => {
    setTheirOffers(prev =>
      prev.includes(golferId) ? prev.filter(id => id !== golferId) : [...prev, golferId]
    );
  };

  const handleSubmit = () => {
    if (myOffers.length === 0 && theirOffers.length === 0) return;
    onSubmit({ proposerGolfers: myOffers, receiverGolfers: theirOffers, message });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-clubhouse-900 border border-clubhouse-700 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-clubhouse-800">
          <div className="flex items-center gap-3">
            <ArrowLeftRight size={20} className="text-sand-400" />
            <h2 className="font-display text-lg font-bold text-clubhouse-100">
              Propose Trade to {theirTeamName}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-clubhouse-500 hover:text-white rounded-lg hover:bg-clubhouse-800">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-2 gap-0 divide-x divide-clubhouse-800 overflow-y-auto max-h-[55vh]">
          {/* My players */}
          <div className="p-4">
            <h3 className="text-xs font-semibold text-clubhouse-400 uppercase tracking-wider mb-3">
              You Send
            </h3>
            <div className="space-y-1">
              {myRoster.map(r => (
                <label key={r.golfer_id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors
                    ${myOffers.includes(r.golfer_id) ? 'bg-red-900/20 border border-red-800/40' : 'hover:bg-clubhouse-800/50 border border-transparent'}`}>
                  <input type="checkbox" checked={myOffers.includes(r.golfer_id)}
                    onChange={() => toggleMyOffer(r.golfer_id)}
                    className="accent-red-500" />
                  <span className="text-sm font-medium text-clubhouse-200">{r.golfers?.name}</span>
                  <span className="text-xs text-clubhouse-500 ml-auto">#{r.golfers?.owgr_rank}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Their players */}
          <div className="p-4">
            <h3 className="text-xs font-semibold text-clubhouse-400 uppercase tracking-wider mb-3">
              You Receive
            </h3>
            <div className="space-y-1">
              {theirRoster.map(r => (
                <label key={r.golfer_id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors
                    ${theirOffers.includes(r.golfer_id) ? 'bg-fairway-900/20 border border-fairway-700/40' : 'hover:bg-clubhouse-800/50 border border-transparent'}`}>
                  <input type="checkbox" checked={theirOffers.includes(r.golfer_id)}
                    onChange={() => toggleTheirOffer(r.golfer_id)}
                    className="accent-fairway-500" />
                  <span className="text-sm font-medium text-clubhouse-200">{r.golfers?.name}</span>
                  <span className="text-xs text-clubhouse-500 ml-auto">#{r.golfers?.owgr_rank}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Message + Submit */}
        <div className="px-6 py-4 border-t border-clubhouse-800 space-y-3">
          <input type="text" value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Add a message (optional)"
            className="input-field text-sm" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-clubhouse-500">
              {myOffers.length} out → {theirOffers.length} in
            </span>
            <button onClick={handleSubmit}
              disabled={myOffers.length === 0 && theirOffers.length === 0}
              className="btn-gold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
              <Send size={14} />
              Send Proposal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
