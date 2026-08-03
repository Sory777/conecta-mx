import type { Business } from './types';

export function waLink(phone10: string, message: string): string {
  const clean = phone10.replace(/\D/g, '').slice(-10);
  return `https://wa.me/52${clean}?text=${encodeURIComponent(message)}`;
}

export function businessWaLink(b: Business, productName?: string): string {
  const base = `Hola ${b.name}, `;
  if (productName) {
    return waLink(b.whatsapp, `${base}me interesa: ${productName}. ¿Me das más información?`);
  }
  return waLink(b.whatsapp, `${base}vi tu negocio en Conecta MX y me gustaría más información.`);
}

export function jobApplyLink(job: { whatsapp?: string; email?: string; title: string; companyName: string }): { type: 'wa' | 'mail'; href: string } | null {
  if (job.whatsapp) {
    return { type: 'wa', href: waLink(job.whatsapp, `Hola, vi la vacante "${job.title}" en ${job.companyName} en Conecta MX y me gustaría aplicar.`) };
  }
  if (job.email) {
    return { type: 'mail', href: `mailto:${job.email}?subject=${encodeURIComponent(`Vacante: ${job.title}`)}&body=${encodeURIComponent(`Hola, vi la vacante "${job.title}" en ${job.companyName} y me gustaría aplicar.`)}` };
  }
  return null;
}

// Parse hours like "Lun-Dom 11:00-23:00" or "Lun-Vie 8:00-18:00, Sab 9:00-14:00"
export function isOpenNow(hours?: string): { open: boolean; label: string } {
  if (!hours) return { open: false, label: 'Horario no disponible' };
  const now = new Date();
  const day = now.getDay(); // 0=Sun ... 6=Sat
  const minutes = now.getHours() * 60 + now.getMinutes();

  const dayMap: Record<string, number[]> = {
    dom: [0], domingo: [0], sun: [0],
    lun: [1], lunes: [1], mon: [1],
    mar: [2], martes: [2], mie: [3], miercoles: [3], mié: [3], wed: [3],
    jue: [4], jueves: [4], thu: [4],
    vie: [5], viernes: [5], fri: [5],
    sab: [6], sábado: [6], sabado: [6], sat: [6],
  };

  const ranges = hours.split(/[,;]/).map((s) => s.trim()).filter(Boolean);

  function parseTime(t: string): number | null {
    const m = t.match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  function matchDay(spec: string): boolean {
    const lower = spec.toLowerCase();
    if (lower.includes('lun-dom') || lower.includes('lun a dom') || lower.includes('todos')) return true;
    if (lower.includes('lun-vie') || lower.includes('lun a vie')) return day >= 1 && day <= 5;
    if (lower.includes('lun-sab') || lower.includes('lun a sab')) return day >= 1 && day <= 6;
    if (lower.includes('mar-dom') || lower.includes('mar a dom')) return day >= 2;
    if (lower.includes('mie-dom') || lower.includes('mie a dom') || lower.includes('mié-dom')) return day >= 3;
    if (lower.includes('jue-dom') || lower.includes('jue a dom')) return day >= 4;
    if (lower.includes('vie-dom') || lower.includes('vie a dom') || lower.includes('sab-dom') || lower.includes('sab a dom') || lower.includes('sáb-dom')) return day >= 5;
    // parse ranges like "mie-jue" (Wed-Thu): check if day falls within the range
    const rangeMatch = lower.match(/([a-záéíóú]+)\s*[-a]\s*([a-záéíóú]+)/);
    if (rangeMatch) {
      const startDays = dayMap[rangeMatch[1]];
      const endDays = dayMap[rangeMatch[2]];
      if (startDays && endDays) {
        const startDay = startDays[0];
        const endDay = endDays[0];
        if (startDay <= endDay) {
          return day >= startDay && day <= endDay;
        } else {
          return day >= startDay || day <= endDay;
        }
      }
    }
    // explicit single days
    for (const key of Object.keys(dayMap)) {
      if (lower.includes(key)) {
        return dayMap[key].includes(day);
      }
    }
    return false; // if no day spec recognized, assume closed
  }

  for (const range of ranges) {
    const timeMatch = range.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (!timeMatch) continue;
    const start = parseTime(timeMatch[1]);
    const end = parseTime(timeMatch[2]);
    if (start === null || end === null) continue;
    if (matchDay(range) && minutes >= start && minutes <= end) {
      return { open: true, label: `Abierto · ${timeMatch[1]}-${timeMatch[2]}` };
    }
  }
  return { open: false, label: 'Cerrado ahora' };
}

export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return phone;
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const day = Math.floor(diff / 86400000);
  if (day > 30) return `hace ${Math.floor(day / 30)} meses`;
  if (day > 0) return `hace ${day} días`;
  const hr = Math.floor(diff / 3600000);
  if (hr > 0) return `hace ${hr}h`;
  const min = Math.floor(diff / 60000);
  return min > 0 ? `hace ${min}min` : 'justo ahora';
}

export function mapsDirectionsLink(b: Business): string | null {
  if (b.coords && typeof b.coords.lat === 'number' && typeof b.coords.lng === 'number'
      && isFinite(b.coords.lat) && isFinite(b.coords.lng)
      && b.coords.lat >= -90 && b.coords.lat <= 90
      && b.coords.lng >= -180 && b.coords.lng <= 180) {
    return `https://www.google.com/maps/dir/?api=1&destination=${b.coords.lat},${b.coords.lng}`;
  }
  if (b.mapsLink) return b.mapsLink;
  if (b.address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address + ', ' + b.municipality + ', México')}`;
  return null;
}

export function mapsEmbedSrc(b: Business): string {
  if (b.coords && typeof b.coords.lat === 'number' && typeof b.coords.lng === 'number'
      && isFinite(b.coords.lat) && isFinite(b.coords.lng)
      && b.coords.lat >= -90 && b.coords.lat <= 90
      && b.coords.lng >= -180 && b.coords.lng <= 180) {
    return `https://maps.google.com/maps?q=${b.coords.lat},${b.coords.lng}&output=embed`;
  }
  const q = encodeURIComponent((b.address || b.municipality) + ', México');
  return `https://maps.google.com/maps?q=${q}&output=embed`;
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
