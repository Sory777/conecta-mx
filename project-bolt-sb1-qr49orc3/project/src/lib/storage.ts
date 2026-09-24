import type { Business, Job, Product, Review, Stats, CV, Event, AnalyticsEventType, Favorite, Report, ReportReason, BusinessClaim, Ad, VendorLocation } from './types';
import { supabase } from './supabase';

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getVisitorId(): string {
  const KEY = 'cmx_visitor_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

export const storage = {
  async getBusinesses(): Promise<Business[]> {
    const pageSize = 1000;
    const first = await supabase
      .from('businesses')
      .select('*', { count: 'exact' })
      .order('createdAt', { ascending: false })
      .range(0, pageSize - 1);
    if (first.error) throw first.error;
    const all: Business[] = [...((first.data || []) as Business[])];
    const total = first.count ?? all.length;
    if (total > pageSize) {
      const pageStarts: number[] = [];
      for (let from = pageSize; from < total; from += pageSize) pageStarts.push(from);
      // Fetch the remaining pages in parallel instead of one-at-a-time —
      // with 6,000+ rows that was 7 sequential round trips before anything
      // showed up on screen.
      const rest = await Promise.all(
        pageStarts.map((from) =>
          supabase.from('businesses').select('*').order('createdAt', { ascending: false }).range(from, from + pageSize - 1)
        ),
      );
      for (const r of rest) {
        if (r.error) throw r.error;
        all.push(...((r.data || []) as Business[]));
      }
    }
    return all;
  },

  async saveBusinesses(list: Business[]): Promise<void> {
    const { error } = await supabase.from('businesses').upsert(list);
    if (error) throw error;
  },

  async addBusiness(b: Business): Promise<void> {
    const { error } = await supabase.from('businesses').insert(b);
    if (error) throw error;
  },

  async updateBusiness(id: string, updates: Partial<Business>): Promise<void> {
    const { error } = await supabase.from('businesses').update(updates).eq('id', id);
    if (error) throw error;
  },

  async deleteBusiness(id: string): Promise<void> {
    const { error } = await supabase.from('businesses').delete().eq('id', id);
    if (error) throw error;
  },

  async getJobs(): Promise<Job[]> {
    const { data, error } = await supabase.from('jobs').select('*').order('createdAt', { ascending: false });
    if (error) throw error;
    return (data || []) as Job[];
  },

  async getJobsByBusiness(businessId: string): Promise<Job[]> {
    const { data, error } = await supabase.from('jobs').select('*').eq('businessId', businessId).order('createdAt', { ascending: false });
    if (error) throw error;
    return (data || []) as Job[];
  },

  async addJob(j: Job): Promise<void> {
    const { error } = await supabase.from('jobs').insert(j);
    if (error) throw error;
  },

  async deleteJob(id: string): Promise<void> {
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) throw error;
  },

  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase.from('products').select('*');
    if (error) throw error;
    return (data || []) as Product[];
  },

  async getProductsByBusiness(businessId: string): Promise<Product[]> {
    const { data, error } = await supabase.from('products').select('*').eq('businessId', businessId);
    if (error) throw error;
    return (data || []) as Product[];
  },

  async addProduct(p: Product): Promise<void> {
    const { error } = await supabase.from('products').insert(p);
    if (error) throw error;
  },

  async updateProduct(id: string, updates: Partial<Product>): Promise<void> {
    const { error } = await supabase.from('products').update(updates).eq('id', id);
    if (error) throw error;
  },

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
  },

  async getReviews(): Promise<Review[]> {
    const { data, error } = await supabase.from('reviews').select('*').order('createdAt', { ascending: false });
    if (error) throw error;
    return (data || []) as Review[];
  },

  async getReviewsByBusiness(businessId: string): Promise<Review[]> {
    const { data, error } = await supabase.from('reviews').select('*').eq('businessId', businessId).order('createdAt', { ascending: false });
    if (error) throw error;
    return (data || []) as Review[];
  },

  async addReview(r: Review): Promise<void> {
    const { error } = await supabase.from('reviews').insert(r);
    if (error) throw error;
  },

  async deleteReview(id: string): Promise<void> {
    const { error } = await supabase.from('reviews').delete().eq('id', id);
    if (error) throw error;
  },

  async getStats(): Promise<Stats> {
    const { data, error } = await supabase.from('stats').select('*').eq('id', 'app_stats').maybeSingle();
    if (error) throw error;
    if (!data) return { visits: 0, whatsappClicks: 0, mapClicks: 0, qrDownloads: 0 };
    return data as Stats;
  },

  async incrementStat(key: keyof Stats): Promise<void> {
    const { error } = await supabase.rpc('increment_stat', { stat_key: key });
    if (error) throw error;
  },

  async getCVs(): Promise<CV[]> {
    const { data, error } = await supabase.from('cvs').select('*').order('createdAt', { ascending: false });
    if (error) throw error;
    return (data || []) as CV[];
  },

  async getCVsByJob(jobId: string): Promise<CV[]> {
    const { data, error } = await supabase.from('cvs').select('*').eq('jobId', jobId).order('createdAt', { ascending: false });
    if (error) throw error;
    return (data || []) as CV[];
  },

  async addCV(cv: CV): Promise<void> {
    const { error } = await supabase.from('cvs').insert(cv);
    if (error) throw error;
  },

  async deleteCV(id: string): Promise<void> {
    const { error } = await supabase.from('cvs').delete().eq('id', id);
    if (error) throw error;
  },

  async getEvents(): Promise<Event[]> {
    const { data, error } = await supabase.from('events').select('*').order('createdAt', { ascending: false });
    if (error) throw error;
    return (data || []) as Event[];
  },

  async getEventsByMunicipality(municipality: string): Promise<Event[]> {
    const { data, error } = await supabase.from('events').select('*').eq('municipality', municipality).order('createdAt', { ascending: false });
    if (error) throw error;
    return (data || []) as Event[];
  },

  async addEvent(event: Event): Promise<void> {
    const { error } = await supabase.from('events').insert(event);
    if (error) throw error;
  },

  async deleteEvent(id: string): Promise<void> {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw error;
  },

  // --- Analytics ---
  async trackEvent(businessId: string | null, productId: string | null, eventType: AnalyticsEventType): Promise<void> {
    const visitorId = getVisitorId();
    const { error } = await supabase.rpc('track_event', {
      p_business_id: businessId,
      p_product_id: productId,
      p_event_type: eventType,
      p_visitor_id: visitorId,
    });
    if (error) throw error;
  },

  async getAnalyticsByBusiness(businessId: string): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('analytics_events')
      .select('event_type')
      .eq('business_id', businessId);
    if (error) throw error;
    const counts: Record<string, number> = {};
    (data || []).forEach((e: { event_type: string }) => {
      counts[e.event_type] = (counts[e.event_type] || 0) + 1;
    });
    return counts;
  },

  async getAnalyticsByProduct(productId: string): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('analytics_events')
      .select('event_type')
      .eq('product_id', productId);
    if (error) throw error;
    const counts: Record<string, number> = {};
    (data || []).forEach((e: { event_type: string }) => {
      counts[e.event_type] = (counts[e.event_type] || 0) + 1;
    });
    return counts;
  },

  async getUniqueVisitors(businessId: string): Promise<number> {
    const { data, error } = await supabase
      .from('analytics_events')
      .select('visitor_id')
      .eq('business_id', businessId)
      .eq('event_type', 'view');
    if (error) throw error;
    const unique = new Set((data || []).map((e: { visitor_id: string | null }) => e.visitor_id).filter(Boolean));
    return unique.size;
  },

  // --- Favorites ---
  async getFavorites(itemType: Favorite['item_type']): Promise<Favorite[]> {
    const { data, error } = await supabase.from('favorites').select('*').eq('item_type', itemType).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as Favorite[];
  },

  async getFavoriteIds(itemType: Favorite['item_type']): Promise<Set<string>> {
    const favs = await this.getFavorites(itemType);
    return new Set(favs.map((f) => f.item_id));
  },

  async addFavorite(itemType: Favorite['item_type'], itemId: string): Promise<void> {
    const { error } = await supabase.from('favorites').insert({ item_type: itemType, item_id: itemId });
    if (error) throw error;
  },

  async removeFavorite(itemType: Favorite['item_type'], itemId: string): Promise<void> {
    const { error } = await supabase.from('favorites').delete().eq('item_type', itemType).eq('item_id', itemId);
    if (error) throw error;
  },

  // --- Reports ---
  async submitReport(itemType: Report['item_type'], itemId: string, reason: ReportReason, details?: string): Promise<void> {
    const { error } = await supabase.from('reports').insert({ item_type: itemType, item_id: itemId, reason, details });
    if (error) throw error;
  },

  async getReports(): Promise<Report[]> {
    const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as Report[];
  },

  async updateReportStatus(id: string, status: Report['status']): Promise<void> {
    const { error } = await supabase.from('reports').update({ status }).eq('id', id);
    if (error) throw error;
  },

  // --- Admin helpers ---
  async isAdmin(): Promise<boolean> {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) return false;
    return data === true;
  },

  // --- Business claims ---
  async submitBusinessClaim(businessId: string, userName: string, userEmail: string, userPhone?: string): Promise<void> {
    const { error } = await supabase.from('business_claims').insert({
      business_id: businessId, user_name: userName, user_email: userEmail, user_phone: userPhone,
    });
    if (error) throw error;
  },

  async getBusinessClaims(): Promise<BusinessClaim[]> {
    const { data, error } = await supabase.from('business_claims').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as BusinessClaim[];
  },

  async resolveBusinessClaim(claim: BusinessClaim, approve: boolean): Promise<void> {
    const { error } = await supabase.from('business_claims').update({ status: approve ? 'approved' : 'rejected' }).eq('id', claim.id);
    if (error) throw error;
    if (approve) {
      const { error: bErr } = await supabase.from('businesses').update({ verified: true }).eq('id', claim.business_id);
      if (bErr) throw bErr;
    }
  },

  // --- Ads ---
  async getActiveAds(): Promise<Ad[]> {
    const { data, error } = await supabase.from('ads').select('*').eq('active', true).order('sort_order', { ascending: true });
    if (error) throw error;
    return (data || []) as Ad[];
  },

  async getAllAds(): Promise<Ad[]> {
    const { data, error } = await supabase.from('ads').select('*').order('sort_order', { ascending: true });
    if (error) throw error;
    return (data || []) as Ad[];
  },

  async addAd(ad: Omit<Ad, 'id' | 'views' | 'skips' | 'created_at'>): Promise<void> {
    const { error } = await supabase.from('ads').insert(ad);
    if (error) throw error;
  },

  async updateAd(id: string, updates: Partial<Ad>): Promise<void> {
    const { error } = await supabase.from('ads').update(updates).eq('id', id);
    if (error) throw error;
  },

  async deleteAd(id: string): Promise<void> {
    const { error } = await supabase.from('ads').delete().eq('id', id);
    if (error) throw error;
  },

  async trackAdStat(adId: string, stat: 'view' | 'skip'): Promise<void> {
    const { error } = await supabase.rpc('increment_ad_stat', { p_ad_id: adId, p_stat: stat });
    if (error) throw error;
  },

  // --- Vendor live location (ambulantes) ---
  async getVendorLocation(businessId: string): Promise<VendorLocation | null> {
    const { data, error } = await supabase.from('vendor_locations').select('*').eq('business_id', businessId).maybeSingle();
    if (error) throw error;
    return data as VendorLocation | null;
  },

  async setVendorLocation(businessId: string, lat: number, lng: number): Promise<void> {
    const { error } = await supabase.from('vendor_locations').upsert({
      business_id: businessId, lat, lng, active: true, updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  },

  async stopVendorLocation(businessId: string): Promise<void> {
    const { error } = await supabase.from('vendor_locations').update({ active: false, updated_at: new Date().toISOString() }).eq('business_id', businessId);
    if (error) throw error;
  },
};

export async function recomputeBusinessRatings(businessId: string): Promise<void> {
  const { error } = await supabase.rpc('recompute_rating', { p_business_id: businessId });
  if (error) throw error;
}
