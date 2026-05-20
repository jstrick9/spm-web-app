import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Layout, Guest, PlacedTable, PlacedFixture, Venue, User, DecorArrangement } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

class DatabaseService {
  private supabase: SupabaseClient | null = null;
  private useLocalStorage = false;

  constructor() {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('✅ Supabase connected');
    } else {
      this.useLocalStorage = true;
      console.warn('⚠️ Using localStorage fallback (dev mode)');
    }
  }

  private getSupabase(): SupabaseClient {
    if (!this.supabase) {
      throw new Error('Supabase client is not initialized. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
    }
    return this.supabase;
  }

  // ==================== LAYOUTS ====================
  async getLayouts(venueId?: string): Promise<Layout[]> {
    if (this.useLocalStorage) {
      const stored = localStorage.getItem('spm_savedLayouts');
      const all = stored ? JSON.parse(stored) : [];
      return venueId ? all.filter((l: Layout) => l.venueId === venueId) : all;
    }

    const query = this.getSupabase().from('layouts').select('*');
    if (venueId) query.eq('venueId', venueId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async saveLayout(layout: Layout, userId: string): Promise<string> {
    const payload = {
      ...layout,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };

    if (this.useLocalStorage) {
      const existing = await this.getLayouts();
      const index = existing.findIndex(l => l.id === layout.id);
      if (index >= 0) existing[index] = payload;
      else existing.push(payload);
      localStorage.setItem('spm_savedLayouts', JSON.stringify(existing));
      return layout.id;
    }

    const { data, error } = await this.getSupabase()
      .from('layouts')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return data.id;
  }

  async deleteLayout(layoutId: string): Promise<void> {
    if (this.useLocalStorage) {
      const existing = await this.getLayouts();
      localStorage.setItem('spm_savedLayouts', JSON.stringify(existing.filter(l => l.id !== layoutId)));
      return;
    }

    const { error } = await this.getSupabase().from('layouts').delete().eq('id', layoutId);
    if (error) throw error;
  }

  // Real-time subscription
  subscribeToLayout(layoutId: string, callback: (layout: Layout) => void) {
    if (this.useLocalStorage) {
      // Fallback: poll every 2 seconds
      const interval = setInterval(async () => {
        const layouts = await this.getLayouts();
        const found = layouts.find(l => l.id === layoutId);
        if (found) callback(found);
      }, 2000);
      return () => clearInterval(interval);
    }

    const channel = this.getSupabase()
      .channel(`layout:${layoutId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'layouts', filter: `id=eq.${layoutId}` },
        (payload) => callback(payload.new as Layout)
      )
      .subscribe();

    return () => { this.getSupabase().removeChannel(channel); };
  }

  // ==================== GUESTS ====================
  async getGuests(layoutId: string): Promise<Guest[]> {
    if (this.useLocalStorage) {
      const stored = localStorage.getItem(`spm_guests_${layoutId}`);
      return stored ? JSON.parse(stored) : [];
    }

    const { data, error } = await this.getSupabase()
      .from('guests')
      .select('*')
      .eq('layoutId', layoutId);
    if (error) throw error;
    return data || [];
  }

  async saveGuests(layoutId: string, guests: Guest[]): Promise<void> {
    if (this.useLocalStorage) {
      localStorage.setItem(`spm_guests_${layoutId}`, JSON.stringify(guests));
      return;
    }

    // Batch upsert
    const payload = guests.map(g => ({ ...g, layoutId }));
    const { error } = await this.getSupabase().from('guests').upsert(payload);
    if (error) throw error;
  }

  // ==================== VENUES ====================
  async getVenues(businessId?: string): Promise<Venue[]> {
    if (this.useLocalStorage) {
      const stored = localStorage.getItem('spm_venues');
      return stored ? JSON.parse(stored) : [];
    }

    const query = this.getSupabase().from('venues').select('*');
    if (businessId) query.eq('businessId', businessId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async saveVenue(venue: Venue): Promise<void> {
    if (this.useLocalStorage) {
      const existing = await this.getVenues();
      const index = existing.findIndex(v => v.id === venue.id);
      if (index >= 0) existing[index] = venue;
      else existing.push(venue);
      localStorage.setItem('spm_venues', JSON.stringify(existing));
      return;
    }

    const { error } = await this.getSupabase().from('venues').upsert(venue);
    if (error) throw error;
  }

  // ==================== VERSION HISTORY ====================
  async saveLayoutVersion(layout: Layout, userId: string, changeDescription: string): Promise<string> {
    const version = {
      id: `v-${Date.now()}`,
      layoutId: layout.id,
      snapshot: JSON.stringify(layout),
      createdBy: userId,
      createdAt: new Date().toISOString(),
      description: changeDescription,
    };

    if (this.useLocalStorage) {
      const key = `spm_versions_${layout.id}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push(version);
      localStorage.setItem(key, JSON.stringify(existing));
      return version.id;
    }

    const { data, error } = await this.getSupabase().from('layout_versions').insert(version).select().single();
    if (error) throw error;
    return data.id;
  }

  async getLayoutHistory(layoutId: string): Promise<any[]> {
    if (this.useLocalStorage) {
      const key = `spm_versions_${layoutId}`;
      return JSON.parse(localStorage.getItem(key) || '[]');
    }

    const { data, error } = await this.getSupabase()
      .from('layout_versions')
      .select('*')
      .eq('layoutId', layoutId)
      .order('createdAt', { ascending: false });
    if (error) throw error;
    return data || [];
  }
}

export const db = new DatabaseService();