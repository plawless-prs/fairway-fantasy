import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLeague } from '../hooks/useLeague';
import { LEAGUE_STATUS_LABELS } from '../lib/constants';
import { Plus, Users, KeyRound, ArrowRight, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { user } = useAuth();
  const { getMyLeagues } = useLeague();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [joinTeamName, setJoinTeamName] = useState('');
  const [showJoin, setShowJoin] = useState(false);

  useEffect(() => {
    if (user) {
      getMyLeagues(user.id).then(({ data }) => {
        setLeagues(data || []);
        setLoading(false);
      });
    }
  }, [user, getMyLeagues]);

  const handleJoin = async () => {
    if (!joinCode.trim() || !joinTeamName.trim()) {
      toast.error('Enter both invite code and team name');
      return;
    }
    const { useLeague: leagueHook } = await import('../hooks/useLeague');
    // Use inline import to avoid hook rules — simpler to just call supabase directly
    const { supabase } = await import('../lib/supabase');

    const { data: league, error: findError } = await supabase
      .from('leagues')
      .select('id, max_teams')
      .eq('invite_code', joinCode.trim())
      .single();

    if (findError || !league) {
      toast.error('League not found. Check your invite code.');
      return;
    }

    const { error: joinError } = await supabase.from('league_members').insert({
      league_id: league.id,
      user_id: user.id,
      team_name: joinTeamName.trim(),
    });

    if (joinError) {
      toast.error(joinError.message.includes('duplicate') ? 'You already joined this league' : joinError.message);
    } else {
      toast.success('Joined the league!');
      navigate(`/league/${league.id}`);
    }
  };

  const statusColors = {
    setup: 'badge-gray',
    drafting: 'badge-gold',
    active: 'badge-green',
    completed: 'badge-gray',
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-clubhouse-50 tracking-tight">My Leagues</h1>
          <p className="text-sm text-clubhouse-500 mt-1">Manage your fantasy golf leagues</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowJoin(!showJoin)} className="btn-secondary flex items-center gap-2 text-sm">
            <KeyRound size={15} /> Join League
          </button>
          <Link to="/league/create" className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Create League
          </Link>
        </div>
      </div>

      {/* Join form */}
      {showJoin && (
        <div className="card mb-6 animate-fade-in-up">
          <h3 className="font-display text-lg font-bold text-clubhouse-100 mb-4">Join a League</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value)}
              placeholder="Invite code (e.g. a1b2c3d4)" className="input-field flex-1" />
            <input type="text" value={joinTeamName} onChange={e => setJoinTeamName(e.target.value)}
              placeholder="Your team name" className="input-field flex-1" />
            <button onClick={handleJoin} className="btn-gold flex items-center gap-2 whitespace-nowrap">
              <ArrowRight size={15} /> Join
            </button>
          </div>
        </div>
      )}

      {/* League list */}
      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card animate-pulse">
              <div className="h-5 w-48 bg-clubhouse-800 rounded mb-3" />
              <div className="h-4 w-32 bg-clubhouse-800 rounded" />
            </div>
          ))}
        </div>
      ) : leagues.length === 0 ? (
        <div className="card text-center py-16">
          <Trophy size={40} className="mx-auto text-clubhouse-600 mb-4" />
          <h3 className="font-display text-xl font-bold text-clubhouse-300 mb-2">No Leagues Yet</h3>
          <p className="text-sm text-clubhouse-500 mb-6">Create a new league or join one with an invite code.</p>
          <Link to="/league/create" className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> Create Your First League
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {leagues.map((membership, i) => {
            const league = membership.leagues;
            if (!league) return null;
            return (
              <Link key={membership.id} to={`/league/${league.id}`}
                className="card-hover flex items-center justify-between animate-fade-in-up"
                style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-fairway-800/30 border border-fairway-700/30 flex items-center justify-center shrink-0">
                    <span className="text-lg">⛳</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-clubhouse-100">{league.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-clubhouse-500">
                        <Users size={12} className="inline mr-1" />
                        {membership.team_name}
                      </span>
                      <span className={statusColors[league.status] || 'badge-gray'}>
                        {LEAGUE_STATUS_LABELS[league.status]}
                      </span>
                    </div>
                  </div>
                </div>
                <ArrowRight size={18} className="text-clubhouse-600" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
