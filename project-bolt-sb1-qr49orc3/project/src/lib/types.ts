export type Plan = 'free' | 'featured' | 'premium';

export type PublicationStatus = 'active' | 'expiring' | 'expired';

export type PublicationTag = 'new' | 'featured' | 'offer' | 'last_units' | 'promotion';

export interface Business {
  id: string;
  name: string;
  municipality: string;
  city: string;
  category: string;
  description: string;
  whatsapp: string;
  phone?: string;
  address?: string;
  mapsLink?: string;
  hours?: string;
  facebook?: string;
  instagram?: string;
  promotion?: string;
  imageUrl?: string;
  plan: Plan;
  verified: boolean;
  founding: boolean;
  rating: number;
  reviewCount: number;
  createdAt: number;
  coords?: { lat: number; lng: number };
  user_id?: string;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  createdAt: number;
  category: string;
  expiresAt?: number;
  tags: string[];
  views: number;
  whatsappClicks: number;
  shares: number;
  uniqueViews: number;
}

export interface Review {
  id: string;
  businessId: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: number;
}

export interface Job {
  id: string;
  companyName: string;
  municipality: string;
  category: string;
  title: string;
  description: string;
  requirements: string;
  salary: string;
  contractType: string;
  contact: string;
  whatsapp?: string;
  email?: string;
  createdAt: number;
  businessId?: string;
}

export interface CV {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  municipality: string;
  position: string;
  experience: string;
  education: string;
  skills: string;
  jobId?: string;
  companyName?: string;
  createdAt: number;
}

export interface Stats {
  visits: number;
  whatsappClicks: number;
  mapClicks: number;
  qrDownloads: number;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  municipality: string;
  location?: string;
  date: string;
  time?: string;
  imageUrl?: string;
  category?: string;
  contact?: string;
  createdAt: number;
}

export type AnalyticsEventType =
  | 'view'
  | 'whatsapp_click'
  | 'share'
  | 'call_click'
  | 'directions_click'
  | 'website_click'
  | 'email_click'
  | 'review'
  | 'favorite';

export interface AnalyticsEvent {
  id: string;
  business_id: string | null;
  product_id: string | null;
  event_type: AnalyticsEventType;
  visitor_id: string | null;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  item_type: 'business' | 'product' | 'event' | 'job';
  item_id: string;
  created_at: string;
}

export type ReportReason = 'fake' | 'wrong_info' | 'inappropriate' | 'fraud';

export interface Report {
  id: string;
  reporter_id: string | null;
  item_type: 'business' | 'product' | 'event' | 'job' | 'review';
  item_id: string;
  reason: ReportReason;
  details?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
}
