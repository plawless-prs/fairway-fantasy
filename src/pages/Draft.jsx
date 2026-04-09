import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLeague } from '../hooks/useLeague';
import DraftBoard from '../components/DraftBoard';

export default function Draft() {
  const { id: leagueId } = useParams();
  const { user } = useAuth();
  const { getLeague } = useLeague();
  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await getLeague(leagueId);
      setLeague(data);
      setLoading(false);
    }
    load();
  }, [leagueId]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-clubhouse-800 rounded mb-4" />
          <div className="h-96 bg-clubhouse-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!league) {
    return <div className="page-container text-center text-clubhouse-400 py-20">League not found</div>;
  }

  if (league.status !== 'drafting') {
    return (
      <div className="page-container text-center py-20">
        <p className="text-clubhouse-400 text-lg">
          {league.status === 'setup'
            ? 'The draft hasn\'t started yet. The commissioner needs to begin the draft.'
            : 'The draft is over!'}
        </p>
      </div>
    );
  }

  const myMembership = league.league_members?.find(m => m.user_id === user?.id);
  const sortedMembers = [...(league.league_members || [])].sort(
    (a, b) => (a.draft_position || 99) - (b.draft_position || 99)
  );

  return (
    <div className="page-container">
      <DraftBoard
        league={league}
        memberId={myMembership?.id}
        members={sortedMembers}
      />
    </div>
  );
}
