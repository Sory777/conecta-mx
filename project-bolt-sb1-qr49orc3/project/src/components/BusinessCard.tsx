import { MapPin, Phone, BadgeCheck, Clock, Sparkles, Navigation } from 'lucide-react';
import type { Business } from '../lib/types';
import { categoryIcon, PLAN_LABELS } from '../lib/constants';
import { businessWaLink, isOpenNow, formatPhone, mapsDirectionsLink } from '../lib/utils';
import { StarRating } from './StarRating';

interface BusinessCardProps {
  business: Business;
  onOpen: (b: Business) => void;
}

export function BusinessCard({ business, onOpen }: BusinessCardProps) {
  const status = isOpenNow(business.hours);
  const CatIcon = categoryIcon(business.category);
  const dirLink = mapsDirectionsLink(business);
  return (
    <div className="card group flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative block aspect-[16/10] overflow-hidden bg-slate-100">
        <button onClick={() => onOpen(business)} className="absolute inset-0 z-0" aria-label={`Ver ${business.name}`} />
        <img
          src={business.imageUrl || 'https://images.unsplash.com/photo-1441986300917-64674ad600d9?w=600&q=80'}
          alt={business.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1441986300917-64674ad600d9?w=600&q=80'; }}
        />
        {dirLink && (
          <a
            href={dirLink}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-lg bg-[#1565C0]/90 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm transition-all hover:bg-[#1565C0] hover:scale-105"
            aria-label="Cómo llegar"
          >
            <Navigation className="h-3.5 w-3.5" /> Cómo llegar
          </a>
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          {business.verified && (
            <span className="badge bg-[#1565C0] text-white shadow">
              <BadgeCheck className="h-3.5 w-3.5" /> Verificado
            </span>
          )}
          {business.founding && (
            <span className="badge bg-amber-400 text-amber-900 shadow">
              <Sparkles className="h-3.5 w-3.5" /> Fundador
            </span>
          )}
          {business.plan !== 'free' && (
            <span className="badge bg-emerald-500 text-white shadow">{PLAN_LABELS[business.plan]}</span>
          )}
        </div>
        <div className="absolute right-2 top-2 z-10">
          <span className={`badge ${status.open ? 'bg-emerald-500 text-white' : 'bg-slate-700/90 text-white'}`}>
            <Clock className="h-3.5 w-3.5" /> {status.open ? 'Abierto' : 'Cerrado'}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <button onClick={() => onOpen(business)} className="text-left">
          <h3 className="line-clamp-1 text-base font-bold text-slate-800 group-hover:text-[#1565C0]">{business.name}</h3>
        </button>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="chip bg-slate-100 text-slate-600">
            <CatIcon className="h-3.5 w-3.5" />
            {business.category}
          </span>
          <span className="inline-flex items-center gap-0.5 text-slate-500">
            <MapPin className="h-3.5 w-3.5" /> {business.municipality}
          </span>
        </div>

        <div className="mt-2">
          <StarRating value={business.rating} showNumber reviewCount={business.reviewCount} />
        </div>

        {business.promotion && (
          <p className="mt-2 line-clamp-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700">
            <Sparkles className="mr-1 inline h-3.5 w-3.5" />
            {business.promotion}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <a
            href={businessWaLink(business)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-wa flex-1 px-3 py-2 text-xs"
          >
            WhatsApp
          </a>
          {business.mapsLink && (
            <a
              href={business.mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline px-3 py-2 text-xs"
              aria-label="Ver mapa"
            >
              <MapPin className="h-4 w-4" />
            </a>
          )}
          <button onClick={() => onOpen(business)} className="btn-ghost px-3 py-2 text-xs">
            Ver
          </button>
        </div>

        {(business.address || business.phone) && (
          <div className="mt-2.5 space-y-0.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
            {business.address && <p className="line-clamp-1"><MapPin className="mr-1 inline h-3 w-3" />{business.address}</p>}
            {business.phone && <p><Phone className="mr-1 inline h-3 w-3" />{formatPhone(business.phone)}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
