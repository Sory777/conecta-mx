import { MapPin, Briefcase, Wallet, Heart, MessageCircle, Mail, FileText } from 'lucide-react';
import type { Job } from '../lib/types';
import { jobApplyLink, timeAgo } from '../lib/utils';

interface JobCardProps {
  job: Job;
  saved: boolean;
  onToggleSave: (id: string) => void;
  onApplyCV: (job: Job) => void;
}

export function JobCard({ job, saved, onToggleSave, onApplyCV }: JobCardProps) {
  const apply = jobApplyLink(job);
  return (
    <div className="card flex flex-col p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-slate-800">{job.title}</h3>
          <p className="text-sm font-medium text-[#1565C0]">{job.companyName}</p>
        </div>
        <button
          onClick={() => onToggleSave(job.id)}
          className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-rose-50"
          aria-label={saved ? 'Quitar de guardados' : 'Guardar vacante'}
        >
          <Heart className={`h-5 w-5 ${saved ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <span className="chip bg-slate-100 text-slate-600">
          <MapPin className="h-3.5 w-3.5" /> {job.municipality}
        </span>
        <span className="chip bg-slate-100 text-slate-600">
          <Briefcase className="h-3.5 w-3.5" /> {job.contractType}
        </span>
        {job.salary && (
          <span className="chip bg-emerald-50 text-emerald-700">
            <Wallet className="h-3.5 w-3.5" /> {job.salary}
          </span>
        )}
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-slate-600">{job.description}</p>

      {job.requirements && (
        <p className="mt-2 line-clamp-2 text-xs text-slate-500">
          <span className="font-semibold">Requisitos:</span> {job.requirements}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-400">{timeAgo(job.createdAt)}</span>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onApplyCV(job)} className="btn-primary px-3 py-2 text-xs">
            <FileText className="h-4 w-4" /> Postular con CV
          </button>
          {apply && apply.type === 'wa' && (
            <a href={apply.href} target="_blank" rel="noopener noreferrer" className="btn-wa px-3 py-2 text-xs">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
          {apply && apply.type === 'mail' && (
            <a href={apply.href} className="btn-outline px-3 py-2 text-xs">
              <Mail className="h-4 w-4" /> Email
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
