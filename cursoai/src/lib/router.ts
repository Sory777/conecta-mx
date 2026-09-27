import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'login' }
  | { name: 'register' }
  | { name: 'new'; q: string }
  | { name: 'diagnosis'; id: string }
  | { name: 'plan'; id: string }
  | { name: 'course'; id: string }
  | { name: 'lesson'; id: string }
  | { name: 'quiz'; id: string }
  | { name: 'tutor'; id: string; lesson: string | null }
  | { name: 'project'; id: string }
  | { name: 'progress' }
  | { name: 'library' }
  | { name: 'profile' }
  | { name: 'certificate'; code: string }
  | { name: 'shared'; code: string };

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const p = path.split('/').filter(Boolean).map(decodeURIComponent);
  const qs = new URLSearchParams(query);
  switch (p[0]) {
    case 'entrar':
      return { name: 'login' };
    case 'registro':
      return { name: 'register' };
    case 'nuevo':
      return { name: 'new', q: qs.get('q') ?? '' };
    case 'curso':
      if (!p[1]) return { name: 'library' };
      if (p[2] === 'diagnostico') return { name: 'diagnosis', id: p[1] };
      if (p[2] === 'plan') return { name: 'plan', id: p[1] };
      if (p[2] === 'tutor') return { name: 'tutor', id: p[1], lesson: qs.get('actividad') };
      if (p[2] === 'proyecto') return { name: 'project', id: p[1] };
      return { name: 'course', id: p[1] };
    case 'actividad':
      return p[1] ? { name: 'lesson', id: p[1] } : { name: 'home' };
    case 'evaluacion':
      return p[1] ? { name: 'quiz', id: p[1] } : { name: 'home' };
    case 'progreso':
      return { name: 'progress' };
    case 'cursos':
      return { name: 'library' };
    case 'perfil':
      return { name: 'profile' };
    case 'certificado':
      return p[1] ? { name: 'certificate', code: p[1] } : { name: 'home' };
    case 'compartido':
      return p[1] ? { name: 'shared', code: p[1] } : { name: 'home' };
    default:
      return { name: 'home' };
  }
}

export function navigate(path: string, replace = false) {
  const hash = path.startsWith('#') ? path : `#${path}`;
  if (replace) window.history.replaceState(null, '', hash);
  else window.history.pushState(null, '', hash);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  return route;
}
