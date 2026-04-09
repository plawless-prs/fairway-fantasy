import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLeague } from '../hooks/useLeague';
import { useRoster } from '../hooks/useRoster';
import {
  FORMAT_OPTIONS, DRAFT_OPTIONS, ROSTER_LOCK_OPTIONS,
  TRADE_REVIEW_OPTIONS, WAIVER_OPTIONS, LEAGUE_STATUS_LABELS,
} from '../lib/constants';
import toast from 'react-hot-toast';
import {
  Shield, Play, Pause, Settings, UserMinus, AlertTriangle,
  Save, Shuffle, Trash2, CheckCircle
} from 'lucide-react';

export default function Commissioner() {
  const { id: leagueId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { getLeague, updateLeague, removeMember, loading } = useLeague();
  const { getWaiverClaims, processWaiverClaim } = useRoster();
  const [league, setLeague] = useState(null);
  const [waivers, setWaivers] = useState([]);
  const [form, setForm] = useState({});
  const [pageLoading, setPageLoading] = useState(true);
  const [tab, setTab] = useState('settings');

  useEffect(() => {
    async function load() {
      const { data } = await getLeague(leagueId);
      if (data && data.commissioner_id !== user?.id) {
        toast.error('Only the commissioner can access this page');
        navigate(`/league/${leagueId}`);
        return;
      }
      setLeague(data);
      if (data) {
        setForm({
          name: data.name,
          max_teams: data.max_teams,
          format: data.format,
          draft_type: data.draft_type,
          roster_starters: data.roster_starters,
          roster_bench: data.roster_bench,
          roster_lock_type: data.roster_lock_type,
          trade_review: data.trade_review,
          waiver_type: data.waiver_type,
          faab_budget: data.faab_budget,
        });
        const { data: waiverData } = await getWaiverClaims(leagueId);
        setWaivers(waiverData || []);
      }
      setPageLoading(false);
    }
    load();
  }, [leagueId, user]);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const saveSettings = async () => {
    const { error } = await updateLeague(leagueId, form);
    if (error) toast.error(error.message);
    else toast.success('Settings saved!');
  };

  const changeStatus = async (newStatus) => {
    const { error } = await updateLeague(leagueId, { status: newStatus });
    if (error) {
      toast.error(error.message);
    } else {
      setLeague(prev => ({ ...prev, status: newStatus }));
      toast.success(`League status: ${LEAGUE_STATUS_LABELS[newStatus]}`);
    }
  };

  const handleRemoveMember = async (member) => {
    if (!confirm(`Remove ${member.team_name} from the league?`)) return;
    const { error } = await removeMember(member.id);
    if (error) toast.error(error.message);
    else {
      setLeague(prev => ({
        ...prev,
        league_members: prev.league_members.filter(m => m.id !== member.id),
      }));
      toast.success('Member removed');
    }
  };

  const randomizeDraftOrder = async () => {
    if (!league?.league_members) return;
    const shuffled = [...league.league_members].sort(() => Math.random() - 0.5);
    const { supabase } = await import('../lib/supabase');
    for (let i = 0; i < shuffled.length; i++) {
      await supabase.from('league_members')
        .update({ draft_position: i + 1 })
        .eq('id', shuffled[i].id);
    }
    toast.success('Draft order randomized!');
    // Refresh
    const { data } = await getLeague(leagueId);
    setLeague(data);
  };

  const handleWaiver = async (claim, approve) => {
    const status = approve ? 'approved' : 'denied';
    await processWaiverClaim(claim.id, status);

    if (approve) {
      // Execute the add/drop
      const { supabase } = await import('../lib/supabase');
      if (claim.drop_golfer_id) {
        await supabase.from('rosters')
          .delete()
          .eq('league_member_id', claim.member_id)
          .eq('golfer_id', claim.drop_golfer_id);
      }
      await supabase.from('rosters').insert({
        league_member_id: claim.member_id,
        golfer_id: claim.add_golfer_id,
        slot_type: 'bench',
      });
    }

    toast.success(`Waiver ${status}`);
    const { data } = await getWaiverClaims(leagueId);
    setWaivers(data || []);
  };

  const Field = ({ label, children, hint }) => (
    <div>
      <label className="block text-xs font-medium text-clubhouse-400 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-clubhouse-600 mt-1">{hint}</p>}
    </div>
  );

  if (pageLoading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-clubhouse-800 rounded" />
          <div className="h-64 bg-clubhouse-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!league) return null;

  const pendingWaivers = waivers.filter(w => w.status === 'pending');

  const TABS = [
    { key: 'settings', label: 'Settings', icon: <Settings size={15} /> },
    { key: 'members', label: 'Members', icon: <UserMinus size={15} /> },
    { key: 'status', label: 'League Status', icon: <Play size={15} /> },
    { key: 'waivers', label: `Waivers${pendingWaivers.length ? ` (${pendingWaivers.length})` : ''}`, icon: <CheckCircle size={15} /> },
  ];

  return (
    <div className="page-container max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Shield size={24} className="text-sand-400" />
        <div>
          <h1 className="font-display text-3xl font-bold text-clubhouse-50 tracking-tight">Commissioner Panel</h1>
          <p className="text-sm text-clubhouse-500">{league.name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-clubhouse-800 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
              ${tab === t.key
                ? 'border-sand-500 text-clubhouse-100'
                : 'border-transparent text-clubhouse-500 hover:text-clubhouse-300'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Settings Tab */}
      {tab === 'settings' && (
        <div className="space-y-6">
          <div className="card space-y-4">
            <Field label="League Name">
              <input type="text" value={form.name || ''} onChange={e => update('name', e.target.value)}
                className="input-field" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Max Teams">
                <input type="number" value={form.max_teams} onChange={e => update('max_teams', parseInt(e.target.value))}
                  min={2} max={20} className="input-field" />
              </Field>
              <Field label="Format">
                <select value={form.format} onChange={e => update('format', e.target.value)} className="select-field">
                  {FORMAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Starters">
                <input type="number" value={form.roster_starters} onChange={e => update('roster_starters', parseInt(e.target.value))}
                  min={1} max={10} className="input-field" />
              </Field>
              <Field label="Bench">
                <input type="number" value={form.roster_bench} onChange={e => update('roster_bench', parseInt(e.target.value))}
                  min={0} max={5} className="input-field" />
              </Field>
            </div>
            <Field label="Roster Lock">
              <select value={form.roster_lock_type} onChange={e => update('roster_lock_type', e.target.value)} className="select-field">
                {ROSTER_LOCK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Trade Review">
              <select value={form.trade_review} onChange={e => update('trade_review', e.target.value)} className="select-field">
                {TRADE_REVIEW_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Waiver System">
              <select value={form.waiver_type} onChange={e => update('waiver_type', e.target.value)} className="select-field">
                {WAIVER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>

          <button onClick={saveSettings} disabled={loading}
            className="btn-primary flex items-center gap-2">
            <Save size={16} /> {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="space-y-3">
          {(league.league_members || []).map(m => (
            <div key={m.id} className="card flex items-center justify-between">
              <div>
                <span className="font-semibold text-clubhouse-100">{m.team_name}</span>
                <span className="text-xs text-clubhouse-500 ml-2">{m.profiles?.display_name}</span>
                {m.draft_position && (
                  <span className="badge-gray ml-2 text-[10px]">Draft #{m.draft_position}</span>
                )}
                {m.user_id === league.commissioner_id && (
                  <span className="badge-gold ml-2 text-[10px]">Commissioner</span>
                )}
              </div>
              {m.user_id !== league.commissioner_id && (
                <button onClick={() => handleRemoveMember(m)}
                  className="btn-danger text-xs px-3 py-1.5 flex items-center gap-1.5">
                  <Trash2 size={12} /> Remove
                </button>
              )}
            </div>
          ))}
          <button onClick={randomizeDraftOrder} className="btn-secondary flex items-center gap-2 mt-4">
            <Shuffle size={16} /> Randomize Draft Order
          </button>
        </div>
      )}

      {/* Status Tab */}
      {tab === 'status' && (
        <div className="space-y-4">
          <div className="card">
            <p className="text-sm text-clubhouse-400 mb-4">
              Current status: <span className="font-semibold text-clubhouse-200">{LEAGUE_STATUS_LABELS[league.status]}</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              {league.status === 'setup' && (
                <button onClick={() => changeStatus('drafting')}
                  className="btn-gold flex items-center justify-center gap-2 py-3">
                  <Play size={16} /> Start Draft
                </button>
              )}
              {league.status === 'drafting' && (
                <button onClick={() => changeStatus('active')}
                  className="btn-primary flex items-center justify-center gap-2 py-3">
                  <Play size={16} /> End Draft / Start Season
                </button>
              )}
              {league.status === 'active' && (
                <button onClick={() => changeStatus('completed')}
                  className="btn-secondary flex items-center justify-center gap-2 py-3">
                  <Pause size={16} /> End Season
                </button>
              )}
              {league.status !== 'setup' && (
                <button onClick={() => { if (confirm('Reset to setup? This is destructive.')) changeStatus('setup'); }}
                  className="btn-danger flex items-center justify-center gap-2 py-3">
                  <AlertTriangle size={16} /> Reset to Setup
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Waivers Tab */}
      {tab === 'waivers' && (
        <div className="space-y-3">
          {pendingWaivers.length === 0 ? (
            <div className="card text-center py-10 text-clubhouse-500">No pending waiver claims</div>
          ) : pendingWaivers.map(w => (
            <div key={w.id} className="card flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-clubhouse-200">{w.member?.team_name}</span>
                <div className="text-xs text-clubhouse-500 mt-1">
                  Add: <span className="text-fairway-400">{w.add_golfer?.name} (#{w.add_golfer?.owgr_rank})</span>
                  {w.drop_golfer && (
                    <> · Drop: <span className="text-red-400">{w.drop_golfer?.name} (#{w.drop_golfer?.owgr_rank})</span></>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleWaiver(w, true)} className="btn-primary text-xs px-3 py-1.5">
                  Approve
                </button>
                <button onClick={() => handleWaiver(w, false)} className="btn-danger text-xs px-3 py-1.5">
                  Deny
                </button>
              </div>
            </div>
          ))}

          {waivers.filter(w => w.status !== 'pending').length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-clubhouse-500 uppercase tracking-wider mt-6 mb-2">History</h3>
              {waivers.filter(w => w.status !== 'pending').map(w => (
                <div key={w.id} className="card opacity-60">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-clubhouse-300">{w.member?.team_name}</span>
                    <span className={w.status === 'approved' ? 'badge-green' : 'badge-red'}>
                      {w.status}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
