export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';

export interface Plan {
  id: string;
  code: string;
  name: string;
  price_cents: number;
  currency: string;
  max_vehicles: number;
  billing_interval: 'month' | 'year';
}

export interface Subscription {
  id: string;
  owner_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  plans?: Plan;
}

export interface Payment {
  id: string;
  subscription_id: string;
  amount_cents: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  method: string;
  note: string | null;
  paid_at: string;
}

export interface Vehicle {
  id: string;
  owner_id: string;
  alias: string;
  plate: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_speed_kmh: number | null;
  last_heading: number | null;
  last_seen_at: string | null;
  created_at: string;
}

export interface Device {
  id: string;
  vehicle_id: string;
  type: 'phone' | 'hardware';
  external_id: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

/** ¿Cuánto tiempo lleva sin reportar posición? Útil para marcar "offline" en el mapa. */
export function isStale(lastSeenAt: string | null, thresholdMs = 3 * 60 * 1000): boolean {
  if (!lastSeenAt) return true;
  return Date.now() - new Date(lastSeenAt).getTime() > thresholdMs;
}
