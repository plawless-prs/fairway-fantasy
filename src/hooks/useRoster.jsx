import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useRoster() {
  const [loading, setLoading] = useState(false);

  // ─── Roster Operations ────────────────────────────────
  const getMyRoster = useCallback(async (memberId) => {
    const { data, error } = await supabase
      .from('rosters')
      .select('*, golfers(*)')
      .eq('league_member_id', memberId)
      .order('slot_type', { ascending: true });
    return { data, error };
  }, []);

  const addToRoster = useCallback(async (memberId, golferId, slotType = 'starter') => {
    setLoading(true);
    const { data, error } = await supabase.from('rosters').insert({
      league_member_id: memberId,
      golfer_id: golferId,
      slot_type: slotType,
    }).select('*, golfers(*)').single();
    setLoading(false);
    return { data, error };
  }, []);

  const dropFromRoster = useCallback(async (rosterId) => {
    setLoading(true);
    const { error } = await supabase.from('rosters').delete().eq('id', rosterId);
    setLoading(false);
    return { error };
  }, []);

  const moveSlot = useCallback(async (rosterId, newSlotType) => {
    const { data, error } = await supabase
      .from('rosters')
      .update({ slot_type: newSlotType })
      .eq('id', rosterId)
      .select('*, golfers(*)')
      .single();
    return { data, error };
  }, []);

  // ─── Free Agents ──────────────────────────────────────
  const getFreeAgents = useCallback(async (leagueId) => {
    const { data, error } = await supabase.rpc('get_free_agents', {
      p_league_id: leagueId,
    });
    return { data, error };
  }, []);

  // ─── Trades ───────────────────────────────────────────
  const proposeTrade = useCallback(async (tradeData) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trades')
      .insert(tradeData)
      .select()
      .single();
    setLoading(false);
    return { data, error };
  }, []);

  const getTradesForLeague = useCallback(async (leagueId) => {
    const { data, error } = await supabase
      .from('trades')
      .select('*, proposer:league_members!trades_proposer_id_fkey(team_name, user_id), receiver:league_members!trades_receiver_id_fkey(team_name, user_id)')
      .eq('league_id', leagueId)
      .order('created_at', { ascending: false });
    return { data, error };
  }, []);

  const respondToTrade = useCallback(async (tradeId, status, reviewerId = null) => {
    const updates = { status };
    if (reviewerId) {
      updates.reviewed_by = reviewerId;
      updates.reviewed_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from('trades')
      .update(updates)
      .eq('id', tradeId)
      .select()
      .single();
    return { data, error };
  }, []);

  // Execute a completed trade — swap golfers between rosters
  const executeTrade = useCallback(async (trade) => {
    setLoading(true);
    // Move proposer's golfers to receiver
    for (const gId of trade.proposer_golfers) {
      await supabase.from('rosters')
        .update({ league_member_id: trade.receiver_id })
        .eq('league_member_id', trade.proposer_id)
        .eq('golfer_id', gId);
    }
    // Move receiver's golfers to proposer
    for (const gId of trade.receiver_golfers) {
      await supabase.from('rosters')
        .update({ league_member_id: trade.proposer_id })
        .eq('league_member_id', trade.receiver_id)
        .eq('golfer_id', gId);
    }
    // Mark trade completed
    await supabase.from('trades').update({ status: 'completed' }).eq('id', trade.id);
    setLoading(false);
  }, []);

  // ─── Waiver Claims ────────────────────────────────────
  const submitWaiverClaim = useCallback(async (claimData) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('waiver_claims')
      .insert(claimData)
      .select()
      .single();
    setLoading(false);
    return { data, error };
  }, []);

  const getWaiverClaims = useCallback(async (leagueId) => {
    const { data, error } = await supabase
      .from('waiver_claims')
      .select('*, member:league_members(team_name), add_golfer:golfers!waiver_claims_add_golfer_id_fkey(name, owgr_rank), drop_golfer:golfers!waiver_claims_drop_golfer_id_fkey(name, owgr_rank)')
      .eq('league_id', leagueId)
      .order('created_at', { ascending: false });
    return { data, error };
  }, []);

  const processWaiverClaim = useCallback(async (claimId, status) => {
    const { data, error } = await supabase
      .from('waiver_claims')
      .update({ status, processed_at: new Date().toISOString() })
      .eq('id', claimId)
      .select()
      .single();
    return { data, error };
  }, []);

  // ─── All Golfers ──────────────────────────────────────
  const getAllGolfers = useCallback(async () => {
    const { data, error } = await supabase
      .from('golfers')
      .select('*')
      .order('owgr_rank', { ascending: true });
    return { data, error };
  }, []);

  return {
    getMyRoster, addToRoster, dropFromRoster, moveSlot,
    getFreeAgents, getAllGolfers,
    proposeTrade, getTradesForLeague, respondToTrade, executeTrade,
    submitWaiverClaim, getWaiverClaims, processWaiverClaim,
    loading,
  };
}
