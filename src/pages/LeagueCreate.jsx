import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLeague } from '../hooks/useLeague';
import {
  FORMAT_OPTIONS, DRAFT_OPTIONS, ROSTER_LOCK_OPTIONS,
  TRADE_REVIEW_OPTIONS, WAIVER_OPTIONS,
} from '../lib/constants';
import toast from 'react-hot-toast';
import { Settings, Users, Trophy, Shield, ArrowRight } from 'lucide-react';

const Section = ({ icon, title, children }) => (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-display text-lg font-bold text-clubhouse-100">{title}</h3>
      </div>
      {children}
    </div>
  );

  const Field = ({ label, children, hint }) => (
    <div>
      <label className="block text-xs font-medium text-clubhouse-400 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-clubhouse-600 mt-1">{hint}</p>}
    </div>
  );

export default function LeagueCreate() {
  const { user } = useAuth();
  const { createLeague, loading } = useLeague();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    max_teams: 10,
    format: 'season_long',
    draft_type: 'snake',
    roster_starters: 6,
    roster_bench: 2,
    roster_lock_type: 'round_start',
    trade_review: 'commissioner',
    waiver_type: 'inverse_standings',
    faab_budget: 100,
  });

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('League name is required');
      return;
    }

    const { data, error } = await createLeague({
      ...form,
      commissioner_id: user.id,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('League created!');
      navigate(`/league/${data.id}`);
    }
  };

  return (
    <div className="page-container max-w-3xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-clubhouse-50 tracking-tight">Create a League</h1>
        <p className="text-sm text-clubhouse-500 mt-1">Set up your fantasy golf league as commissioner</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Section icon={<Trophy size={20} className="text-sand-400" />} title="League Info">
          <Field label="League Name">
            <input type="text" value={form.name} onChange={e => update('name', e.target.value)}
              placeholder="e.g. The Augusta Invitational"
              className="input-field" required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Max Teams" hint="2–20 teams per league">
              <input type="number" value={form.max_teams} onChange={e => update('max_teams', parseInt(e.target.value))}
                min={2} max={20} className="input-field" />
            </Field>
            <Field label="League Format">
              <select value={form.format} onChange={e => update('format', e.target.value)} className="select-field">
                {FORMAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>
        </Section>

        {/* Roster Settings */}
        <Section icon={<Users size={20} className="text-fairway-400" />} title="Roster Settings">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Starter Slots" hint="Golfers who score each week">
              <input type="number" value={form.roster_starters} onChange={e => update('roster_starters', parseInt(e.target.value))}
                min={1} max={10} className="input-field" />
            </Field>
            <Field label="Bench Slots" hint="Reserve golfers">
              <input type="number" value={form.roster_bench} onChange={e => update('roster_bench', parseInt(e.target.value))}
                min={0} max={5} className="input-field" />
            </Field>
          </div>
          <Field label="Roster Lock">
            <select value={form.roster_lock_type} onChange={e => update('roster_lock_type', e.target.value)} className="select-field">
              {ROSTER_LOCK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </Section>

        {/* Draft Settings */}
        <Section icon={<Settings size={20} className="text-clubhouse-300" />} title="Draft Settings">
          <Field label="Draft Type">
            <select value={form.draft_type} onChange={e => update('draft_type', e.target.value)} className="select-field">
              {DRAFT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </Section>

        {/* Commissioner Controls */}
        <Section icon={<Shield size={20} className="text-sand-400" />} title="Commissioner Controls">
          <Field label="Trade Review" hint="How trades get approved">
            <select value={form.trade_review} onChange={e => update('trade_review', e.target.value)} className="select-field">
              {TRADE_REVIEW_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Waiver System" hint="How free agent pickups work">
            <select value={form.waiver_type} onChange={e => update('waiver_type', e.target.value)} className="select-field">
              {WAIVER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          {form.waiver_type === 'faab' && (
            <Field label="FAAB Budget" hint="$ each team gets for free agent bidding">
              <input type="number" value={form.faab_budget} onChange={e => update('faab_budget', parseInt(e.target.value))}
                min={10} max={1000} className="input-field" />
            </Field>
          )}
        </Section>

        {/* Submit */}
        <button type="submit" disabled={loading}
          className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2">
          {loading ? 'Creating...' : (
            <>Create League <ArrowRight size={18} /></>
          )}
        </button>
      </form>
    </div>
  );
}
