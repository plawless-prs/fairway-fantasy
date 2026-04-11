import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useLeague() {
  const [loading, setLoading] = useState(false);

  const createLeague = useCallback(async (leagueData) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leagues')
      .insert(leagueData)
      .select()
      .single();
    setLoading(false);
    if (data) {
      // Auto-join as first member
      await supabase.from('league_members').insert({
        league_id: data.id,
        user_id: leagueData.commissioner_id,
        team_name: 'Commissioner Team',
        draft_position: 1,
        waiver_priority: 1,
      });
    }
    return { data, error };
  }, []);

  const getLeague = useCallback(async (id) => {
    const { data, error } = await supabase
      .from('leagues')
      .select('*, league_members(*, profiles(display_name))')
      .eq('id', id)
      .single();
    return { data, error };
  }, []);

  const getMyLeagues = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('league_members')
      .select('*, leagues(*)')
      .eq('user_id', userId);
    return { data, error };
  }, []);

  const joinLeague = useCallback(async (inviteCode, userId, teamName) => {
    // Find league by invite code
    const { data: league, error: findError } = await supabase
      .from('leagues')
      .select('id, max_teams, league_members(count)')
      .eq('invite_code', inviteCode)
      .single();

    if (findError || !league) return { error: findError || { message: 'League not found' } };

    // Check if league is full
    const memberCount = league.league_members?.[0]?.count || 0;
    if (memberCount >= league.max_teams) {
      return { error: { message: 'League is full' } };
    }

    const { data, error } = await supabase.from('league_members').insert({
      league_id: league.id,
      user_id: userId,
      team_name: teamName,
      waiver_priority: memberCount + 1,
    }).select().single();

    return { data, error };
  }, []);

  const updateLeague = useCallback(async (id, updates) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leagues')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    setLoading(false);
    return { data, error };
  }, []);

  const getStandings = useCallback(async (leagueId) => {
    const { data, error } = await supabase.rpc('get_league_standings', {
      p_league_id: leagueId,
    });
    return { data, error };
  }, []);

  const removeMember = useCallback(async (memberId) => {
    const { error } = await supabase
      .from('league_members')
      .delete()
      .eq('id', memberId);
    return { error };
  }, []);

  return { createLeague, getLeague, getMyLeagues, joinLeague, updateLeague, getStandings, removeMember, loading };
}
