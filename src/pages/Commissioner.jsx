import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLeague } from '../hooks/useLeague';
import { useRoster } from '../hooks/useRoster';
import { supabase } from '../lib/supabase';
import { getFlag } from '../lib/constants';
import {
  FORMAT_OPTIONS, DRAFT_OPTIONS, ROSTER_LOCK_OPTIONS,
  TRADE_REVIEW_OPTIONS, WAIVER_OPTIONS, LEAGUE_STATUS_LABELS,
} from '../lib/constants';
import toast from 'react-hot-toast';
import {
  Shield, Play, Pause, Settings, UserMinus, AlertTriangle,
  Save, Shuffle, Trash2, CheckCircle, UserPlus, ClipboardList,
  Search, Plus, X, Edit3, ArrowUpDown
} from 'lucide-react';

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-medium text-clubhouse-400 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-clubhouse-600 mt-1">{hint}</p>}
    </div>
  );
}

export default function Commissioner() {
  const { id: leagueId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { getLeague, updateLeague, removeMember, loading } = useLeague();
  const { getWaiverClaims, processWaiverClaim, getAllGolfers } = useRoster();
  const [league, setLeague] = useState(null);
  const [waivers, setWaivers] = useState([]);
  const [form, setForm] = useState({});
  const [pageLoading, setPageLoading] = useState(true);
  const [tab, setTab] = useState('settings');

  // Create account state
  const [newAccount, setNewAccount] = useState({ email: '', password: '', displayName: '', teamName: '' });
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Edit roster state
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberRoster, setMemberRoster] = useState([]);
  const [allGolfers, setAllGolfers] = useState([]);
  const [golferSearch, setGolferSearch] = useState('');
  const [rosterLoading, setRosterLoading] = useState(false);
  const [editTeamName, setEditTeamName] = useState('');
  const [editingTeamName, setEditingTeamName] = useState(false);

  // Load league data
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

  // Load all golfers when roster tab is opened
  useEffect(() => {
    if (tab === 'rosters' && allGolfers.length === 0) {
      getAllGolfers().then(({ data }) => setAllGolfers(data || []));
    }
  }, [tab]);

  const refreshLeague = async () => {
    const { data } = await getLeague(leagueId);
    setLeague(data);
  };

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
    if (!confirm(`Remove ${member.team_name} from the league? This will also delete their roster.`)) return;
    const { error } = await removeMember(member.id);
    if (error) toast.error(error.message);
    else {
      setLeague(prev => ({
        ...prev,
        league_members: prev.league_members.filter(m => m.id !== member.id),
      }));
      if (selectedMember?.id === member.id) {
        setSelectedMember(null);
        setMemberRoster([]);
      }
      toast.success('Member removed');
    }
  };

  const randomizeDraftOrder = async () => {
    if (!league?.league_members) return;
    const shuffled = [...league.league_members].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length; i++) {
      await supabase.from('league_members')
        .update({ draft_position: i + 1 })
        .eq('id', shuffled[i].id);
    }
    toast.success('Draft order randomized!');
    await refreshLeague();
  };

  const handleWaiver = async (claim, approve) => {
    const status = approve ? 'approved' : 'denied';
    await processWaiverClaim(claim.id, status);
    if (approve) {
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

  // ─── Create Account & Add to League ──────────────────────
  const handleCreateAccount = async () => {
    const { email, password, displayName, teamName } = newAccount;
    if (!email || !password || !displayName || !teamName) {
      toast.error('All fields are required');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setCreatingAccount(true);
    try {
      const { data, error } = await supabase.rpc('commissioner_create_member', {
        p_email: email,
        p_password: password,
        p_display_name: displayName,
        p_team_name: teamName,
        p_league_id: leagueId,
      });

      if (error) {
        toast.error(error.message);
      } else if (data && !data.success) {
        toast.error(data.error || 'Failed to create account');
      } else {
        toast.success(`Created account for ${displayName} and added to league!`);
        setNewAccount({ email: '', password: '', displayName: '', teamName: '' });
        await refreshLeague();
      }
    } catch (err) {
      toast.error('Unexpected error: ' + err.message);
    }
    setCreatingAccount(false);
  };

  // Add existing user to league by email
  const [existingEmail, setExistingEmail] = useState('');
  const [existingTeamName, setExistingTeamName] = useState('');

  const handleAddExistingUser = async () => {
    if (!existingEmail || !existingTeamName) {
      toast.error('Email and team name are required');
      return;
    }

    // Look up user by email in profiles (they must have signed up already)
    const { data: profiles, error: lookupError } = await supabase
      .from('profiles')
      .select('id, display_name')
      .ilike('display_name', `%${existingEmail}%`);

    // Since we can't search by email directly in profiles, try auth approach
    // Actually, let's search by the profile display_name or inform the commissioner
    toast.error('To add an existing user, they need to join using the invite code: ' + league?.invite_code);
    return;
  };

  // ─── Roster Management ───────────────────────────────────
  const loadMemberRoster = async (member) => {
    setSelectedMember(member);
    setEditTeamName(member.team_name);
    setEditingTeamName(false);
    setRosterLoading(true);
    const { data } = await supabase
      .from('rosters')
      .select('*, golfers(*)')
      .eq('league_member_id', member.id)
      .order('slot_type');
    setMemberRoster(data || []);
    setRosterLoading(false);
  };

  const addGolferToMember = async (golfer) => {
    if (!selectedMember) return;
    const currentStarters = memberRoster.filter(r => r.slot_type === 'starter').length;
    const maxStarters = league?.roster_starters || 6;
    const maxBench = league?.roster_bench || 2;
    const currentBench = memberRoster.filter(r => r.slot_type === 'bench').length;
    const totalMax = maxStarters + maxBench;

    if (memberRoster.length >= totalMax) {
      toast.error('Roster is full. Drop a player first.');
      return;
    }

    const slotType = currentStarters < maxStarters ? 'starter' : 'bench';

    const { data, error } = await supabase.from('rosters').insert({
      league_member_id: selectedMember.id,
      golfer_id: golfer.id,
      slot_type: slotType,
    }).select('*, golfers(*)').single();

    if (error) {
      if (error.message.includes('duplicate')) {
        toast.error(`${golfer.name} is already on this roster`);
      } else {
        toast.error(error.message);
      }
    } else {
      setMemberRoster(prev => [...prev, data]);
      toast.success(`Added ${golfer.name} as ${slotType}`);
    }
  };

  const dropGolferFromMember = async (rosterEntry) => {
    if (!confirm(`Drop ${rosterEntry.golfers?.name} from ${selectedMember?.team_name}?`)) return;
    const { error } = await supabase.from('rosters').delete().eq('id', rosterEntry.id);
    if (error) {
      toast.error(error.message);
    } else {
      setMemberRoster(prev => prev.filter(r => r.id !== rosterEntry.id));
      toast.success(`Dropped ${rosterEntry.golfers?.name}`);
    }
  };

  const toggleSlot = async (rosterEntry) => {
    const newSlot = rosterEntry.slot_type === 'starter' ? 'bench' : 'starter';
    if (newSlot === 'starter') {
      const currentStarters = memberRoster.filter(r => r.slot_type === 'starter').length;
      if (currentStarters >= (league?.roster_starters || 6)) {
        toast.error('Starter slots full');
        return;
      }
    }
    const { error } = await supabase.from('rosters')
      .update({ slot_type: newSlot })
      .eq('id', rosterEntry.id);
    if (error) {
      toast.error(error.message);
    } else {
      setMemberRoster(prev => prev.map(r =>
        r.id === rosterEntry.id ? { ...r, slot_type: newSlot } : r
      ));
      toast.success(`Moved to ${newSlot}`);
    }
  };

  const saveTeamName = async () => {
    if (!editTeamName.trim()) {
      toast.error('Team name cannot be empty');
      return;
    }
    const { error } = await supabase.from('league_members')
      .update({ team_name: editTeamName.trim() })
      .eq('id', selectedMember.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Team name updated');
      setSelectedMember(prev => ({ ...prev, team_name: editTeamName.trim() }));
      setEditingTeamName(false);
      await refreshLeague();
    }
  };

  // Golfers available to add (not on ANY roster in this league)
  const rostered = new Set();
  (league?.league_members || []).forEach(() => {
    // We only have the selected member's roster loaded, so we'll check via the add call
    // and let the unique constraint handle duplicates across teams
  });
  memberRoster.forEach(r => rostered.add(r.golfer_id));

  const filteredGolfers = allGolfers.filter(g =>
    !rostered.has(g.id) &&
    (g.name.toLowerCase().includes(golferSearch.toLowerCase()) ||
     g.country?.toLowerCase().includes(golferSearch.toLowerCase()))
  );

  // ─── Render ──────────────────────────────────────────────
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
    { key: 'accounts', label: 'Create Accounts', icon: <UserPlus size={15} /> },
    { key: 'rosters', label: 'Edit Rosters', icon: <ClipboardList size={15} /> },
    { key: 'status', label: 'League Status', icon: <Play size={15} /> },
    { key: 'waivers', label: `Waivers${pendingWaivers.length ? ` (${pendingWaivers.length})` : ''}`, icon: <CheckCircle size={15} /> },
  ];

  return (
    <div className="page-container max-w-4xl">
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

      {/* ════════ Settings Tab ════════ */}
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

      {/* ════════ Members Tab ════════ */}
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

      {/* ════════ Create Accounts Tab ════════ */}
      {tab === 'accounts' && (
        <div className="space-y-6">
          {/* Create new account */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <UserPlus size={18} className="text-fairway-400" />
              <h3 className="font-display text-lg font-bold text-clubhouse-100">Create New Account & Add to League</h3>
            </div>
            <p className="text-xs text-clubhouse-500">
              Create a Supabase auth account for someone and automatically add them to this league.
              Share the email and password with them so they can log in and manage their team.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email Address">
                <input type="email" value={newAccount.email}
                  onChange={e => setNewAccount(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="player@example.com"
                  className="input-field" />
              </Field>
              <Field label="Password">
                <input type="text" value={newAccount.password}
                  onChange={e => setNewAccount(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Min 6 characters"
                  className="input-field" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Display Name">
                <input type="text" value={newAccount.displayName}
                  onChange={e => setNewAccount(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="John Smith"
                  className="input-field" />
              </Field>
              <Field label="Team Name">
                <input type="text" value={newAccount.teamName}
                  onChange={e => setNewAccount(prev => ({ ...prev, teamName: e.target.value }))}
                  placeholder="Eagle Chasers"
                  className="input-field" />
              </Field>
            </div>
            <button onClick={handleCreateAccount} disabled={creatingAccount}
              className="btn-primary flex items-center gap-2">
              <UserPlus size={16} />
              {creatingAccount ? 'Creating...' : 'Create Account & Add to League'}
            </button>
          </div>

          {/* Current members list */}
          <div className="card space-y-3">
            <h3 className="text-xs font-semibold text-clubhouse-400 uppercase tracking-wider">
              Current Members ({league.league_members?.length || 0} / {league.max_teams})
            </h3>
            {(league.league_members || []).map(m => (
              <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-clubhouse-800/30">
                <div>
                  <span className="text-sm font-medium text-clubhouse-200">{m.team_name}</span>
                  <span className="text-xs text-clubhouse-500 ml-2">{m.profiles?.display_name}</span>
                </div>
                <span className="badge-green text-[10px]">Active</span>
              </div>
            ))}
          </div>

          {/* Invite code reminder */}
          <div className="card border-sand-800/30 bg-sand-900/10">
            <p className="text-sm text-sand-300">
              Existing users can also join with invite code:
              <code className="ml-2 px-2 py-1 rounded bg-clubhouse-800 text-sand-400 font-mono text-sm">
                {league.invite_code}
              </code>
            </p>
          </div>
        </div>
      )}

      {/* ════════ Edit Rosters Tab ════════ */}
      {tab === 'rosters' && (
        <div className="space-y-6">
          {/* Team selector */}
          <div className="card">
            <h3 className="text-xs font-semibold text-clubhouse-400 uppercase tracking-wider mb-3">
              Select a Team to Edit
            </h3>
            <div className="flex flex-wrap gap-2">
              {(league.league_members || []).map(m => (
                <button key={m.id} onClick={() => loadMemberRoster(m)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border
                    ${selectedMember?.id === m.id
                      ? 'bg-fairway-800/40 border-fairway-600/50 text-fairway-300'
                      : 'bg-clubhouse-800 border-clubhouse-700 text-clubhouse-300 hover:border-clubhouse-500'}`}>
                  {m.team_name}
                </button>
              ))}
            </div>
          </div>

          {/* Selected team roster */}
          {selectedMember && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Current Roster */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  {editingTeamName ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input type="text" value={editTeamName}
                        onChange={e => setEditTeamName(e.target.value)}
                        className="input-field text-sm py-1.5 flex-1" />
                      <button onClick={saveTeamName} className="btn-primary text-xs px-3 py-1.5">Save</button>
                      <button onClick={() => setEditingTeamName(false)}
                        className="p-1.5 text-clubhouse-500 hover:text-white"><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-bold text-clubhouse-100">
                        {selectedMember.team_name}
                      </h3>
                      <button onClick={() => setEditingTeamName(true)}
                        className="p-1.5 text-clubhouse-500 hover:text-sand-400 rounded-lg hover:bg-clubhouse-800">
                        <Edit3 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-clubhouse-500">
                  {selectedMember.profiles?.display_name} ·
                  {memberRoster.filter(r => r.slot_type === 'starter').length}/{league.roster_starters} starters ·
                  {memberRoster.filter(r => r.slot_type === 'bench').length}/{league.roster_bench} bench
                </p>

                {rosterLoading ? (
                  <div className="animate-pulse space-y-2">
                    {[1,2,3].map(i => <div key={i} className="h-14 bg-clubhouse-800 rounded-xl" />)}
                  </div>
                ) : memberRoster.length === 0 ? (
                  <div className="card text-center py-8 text-clubhouse-500 text-sm">
                    No golfers on this roster yet. Add golfers from the list.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Starters */}
                    <h4 className="text-[10px] font-semibold text-clubhouse-500 uppercase tracking-widest mt-2">Starters</h4>
                    {memberRoster.filter(r => r.slot_type === 'starter').map(r => (
                      <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-clubhouse-900/60 border border-clubhouse-800 group">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0
                          ${r.golfers?.owgr_rank <= 10 ? 'bg-sand-700/30 text-sand-300' :
                            r.golfers?.owgr_rank <= 25 ? 'bg-fairway-800/40 text-fairway-300' :
                            'bg-clubhouse-800 text-clubhouse-400'}`}>
                          {r.golfers?.owgr_rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{getFlag(r.golfers?.country)}</span>
                            <span className="text-sm font-medium text-clubhouse-200 truncate">{r.golfers?.name}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => toggleSlot(r)}
                            className="p-1.5 rounded-md text-clubhouse-400 hover:text-sand-300 hover:bg-clubhouse-800"
                            title="Move to Bench">
                            <ArrowUpDown size={12} />
                          </button>
                          <button onClick={() => dropGolferFromMember(r)}
                            className="p-1.5 rounded-md text-clubhouse-400 hover:text-red-400 hover:bg-red-900/20"
                            title="Drop">
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Bench */}
                    <h4 className="text-[10px] font-semibold text-clubhouse-500 uppercase tracking-widest mt-4">Bench</h4>
                    {memberRoster.filter(r => r.slot_type === 'bench').map(r => (
                      <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-clubhouse-900/40 border border-clubhouse-800/60 group">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 bg-clubhouse-800 text-clubhouse-500">
                          {r.golfers?.owgr_rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{getFlag(r.golfers?.country)}</span>
                            <span className="text-sm font-medium text-clubhouse-300 truncate">{r.golfers?.name}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => toggleSlot(r)}
                            className="p-1.5 rounded-md text-clubhouse-400 hover:text-fairway-400 hover:bg-clubhouse-800"
                            title="Move to Starter">
                            <ArrowUpDown size={12} />
                          </button>
                          <button onClick={() => dropGolferFromMember(r)}
                            className="p-1.5 rounded-md text-clubhouse-400 hover:text-red-400 hover:bg-red-900/20"
                            title="Drop">
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Empty slots */}
                    {Array.from({ length: Math.max(0, (league.roster_starters + league.roster_bench) - memberRoster.length) }).map((_, i) => (
                      <div key={`empty-${i}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 border-dashed border-clubhouse-800/50">
                        <div className="w-8 h-8 rounded-lg bg-clubhouse-800/30 flex items-center justify-center">
                          <span className="text-clubhouse-700 text-sm">?</span>
                        </div>
                        <span className="text-xs text-clubhouse-600 italic">Empty slot</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Golfers */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-clubhouse-400 uppercase tracking-wider">
                  Add Golfer to {selectedMember.team_name}
                </h3>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-clubhouse-500" />
                  <input type="text" value={golferSearch}
                    onChange={e => setGolferSearch(e.target.value)}
                    placeholder="Search by name or country..."
                    className="input-field pl-9 text-sm" />
                </div>
                <div className="card p-0 max-h-[500px] overflow-y-auto divide-y divide-clubhouse-800/40">
                  {filteredGolfers.slice(0, 50).map(g => (
                    <div key={g.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-clubhouse-800/40 transition-colors cursor-pointer"
                      onClick={() => addGolferToMember(g)}>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[10px] text-clubhouse-500 w-5 text-right">{g.owgr_rank}</span>
                        <span className="text-xs">{getFlag(g.country)}</span>
                        <span className="text-sm text-clubhouse-200">{g.name}</span>
                      </div>
                      <button className="btn-primary text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); addGolferToMember(g); }}>
                        <Plus size={11} />
                      </button>
                    </div>
                  ))}
                  {filteredGolfers.length === 0 && (
                    <div className="p-6 text-center text-xs text-clubhouse-500">
                      {golferSearch ? 'No golfers match your search' : 'Loading golfers...'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!selectedMember && (
            <div className="card text-center py-12 text-clubhouse-500">
              Select a team above to view and edit their roster
            </div>
          )}
        </div>
      )}

      {/* ════════ Status Tab ════════ */}
      {tab === 'status' && (
        <div className="space-y-4">
          <div className="card">
            <p className="text-sm text-clubhouse-400 mb-4">
              Current status: <span className="font-semibold text-clubhouse-200">{LEAGUE_STATUS_LABELS[league.status]}</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              {league.status === 'setup' && (
                <>
                  <button onClick={() => changeStatus('drafting')}
                    className="btn-gold flex items-center justify-center gap-2 py-3">
                    <Play size={16} /> Start Draft
                  </button>
                  <button onClick={() => changeStatus('active')}
                    className="btn-primary flex items-center justify-center gap-2 py-3">
                    <Play size={16} /> Skip Draft & Start Season
                  </button>
                </>
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

          <div className="card border-red-800/30 bg-red-900/10 mt-6">
            <h3 className="text-sm font-semibold text-red-300 mb-2">Danger Zone</h3>
            <p className="text-xs text-clubhouse-500 mb-4">
              Permanently delete this league and all its data (teams, rosters, trades, draft picks). This cannot be undone.
            </p>
            <button onClick={async () => {
              if (!confirm('Are you sure you want to DELETE this entire league? This cannot be undone.')) return;
              if (!confirm('Really sure? All teams, rosters, and history will be lost forever.')) return;
              const { error } = await supabase.from('leagues').delete().eq('id', leagueId);
              if (error) {
                toast.error(error.message);
              } else {
                toast.success('League deleted');
                navigate('/dashboard');
              }
            }}
              className="btn-danger flex items-center gap-2">
              <Trash2 size={15} /> Delete League Permanently
            </button>
          </div>
        </div>
      )}

      {/* ════════ Waivers Tab ════════ */}
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
