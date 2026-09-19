import { useEffect, useMemo, useState } from 'react';
import { storage } from './lib/storage';
import { supabase } from './lib/supabase';
import { AuthProvider, useAuth } from './lib/auth';
import type { Business, Job, Event } from './lib/types';
import { ToastProvider, useToast } from './components/Toast';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { DirectoryPage } from './pages/DirectoryPage';
import { RegisterPage } from './pages/RegisterPage';
import { BusinessDetailPage } from './pages/BusinessDetailPage';
import { JobsPage } from './pages/JobsPage';
import { QRPage } from './pages/QRPage';
import { AdminPage } from './pages/AdminPage';
import { PlansPage } from './pages/PlansPage';
import { EventsPage } from './pages/EventsPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { InstallBanner } from './components/InstallBanner';

type Route =
  | { name: 'home' }
  | { name: 'directory'; query?: string; muni?: string; category?: string }
  | { name: 'register' }
  | { name: 'login' }
  | { name: 'dashboard' }
  | { name: 'business'; id: string }
  | { name: 'jobs' }
  | { name: 'events' }
  | { name: 'qr' }
  | { name: 'admin' }
  | { name: 'plans' };

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'home' };
  switch (parts[0]) {
    case 'directory': {
      const params = new URLSearchParams(parts.slice(1).join('&'));
      return { name: 'directory', query: params.get('q') || '', muni: params.get('m') || '', category: params.get('c') || '' };
    }
    case 'register':
      return { name: 'register' };
    case 'login':
      return { name: 'login' };
    case 'dashboard':
      return { name: 'dashboard' };
    case 'business':
      return { name: 'business', id: parts[1] || '' };
    case 'jobs':
      return { name: 'jobs' };
    case 'events':
      return { name: 'events' };
    case 'qr':
      return { name: 'qr' };
    case 'admin':
      return { name: 'admin' };
    case 'plans':
      return { name: 'plans' };
    default:
      return { name: 'home' };
  }
}

function setHash(route: Route, params?: Record<string, string>) {
  if (route.name === 'directory' && params) {
    const sp = new URLSearchParams();
    if (params.q) sp.set('q', params.q);
    if (params.m) sp.set('m', params.m);
    const cat = params.c || params.category || '';
    if (cat) sp.set('c', cat);
    window.location.hash = `#/directory?${sp.toString()}`;
    return;
  }
  const map: Record<string, string> = {
    home: '', directory: '/directory', register: '/register', login: '/login', dashboard: '/dashboard',
    jobs: '/jobs', events: '/events', qr: '/qr', admin: '/admin', plans: '/plans',
  };
  if (route.name === 'business') {
    window.location.hash = `#/business/${route.id}`;
    return;
  }
  window.location.hash = `#${map[route.name] || ''}`;
}

function AppInner() {
  const { toast } = useToast();
  const { user, business, isAdmin } = useAuth();
  const [route, setRoute] = useState<Route>(() => parseHash());
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [savedJobs, setSavedJobs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('cmx_saved_jobs') || '[]'); } catch { return []; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [biz, jb, ev] = await Promise.allSettled([storage.getBusinesses(), storage.getJobs(), storage.getEvents()]);
      if (!active) return;
      if (biz.status === 'fulfilled') setBusinesses(biz.value);
      else console.error('Failed to load businesses:', biz.reason);
      if (jb.status === 'fulfilled') setJobs(jb.value);
      else console.error('Failed to load jobs:', jb.reason);
      if (ev.status === 'fulfilled') setEvents(ev.value);
      else console.error('Failed to load events:', ev.reason);
      if (biz.status === 'rejected' && active) toast('No se pudieron cargar los negocios. Revisa tu conexión.', 'error');
      await storage.incrementStat('visits').catch(() => {});
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('public:businesses_jobs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'businesses' }, () => {
        storage.getBusinesses().then(setBusinesses).catch(() => {});
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, () => {
        storage.getJobs().then(setJobs).catch(() => {});
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'businesses' }, () => {
        storage.getBusinesses().then(setBusinesses).catch(() => {});
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'jobs' }, () => {
        storage.getJobs().then(setJobs).catch(() => {});
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, () => {
        storage.getEvents().then(setEvents).catch(() => {});
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'events' }, () => {
        storage.getEvents().then(setEvents).catch(() => {});
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (name: string, params?: Record<string, string>) => {
    if (name === 'directory' && params) {
      setHash({ name: 'directory' }, params);
    } else if (name === 'business' && params?.id) {
      setHash({ name: 'business', id: params.id });
    } else {
      setHash({ name: name as Route['name'] } as Route, params);
    }
  };

  const refreshBusinesses = async () => setBusinesses(await storage.getBusinesses());
  const refreshJobs = async () => setJobs(await storage.getJobs());
  const refreshEvents = async () => setEvents(await storage.getEvents());

  const openBusiness = (b: Business) => {
    navigate('business', { id: b.id });
  };

  const toggleSaveJob = (id: string) => {
    const next = savedJobs.includes(id) ? savedJobs.filter((x) => x !== id) : [...savedJobs, id];
    setSavedJobs(next);
    localStorage.setItem('cmx_saved_jobs', JSON.stringify(next));
    toast(savedJobs.includes(id) ? 'Vacante quitada de guardados' : 'Vacante guardada', 'success');
  };

  const track = (key: 'whatsappClicks' | 'mapClicks' | 'qrDownloads') => {
    storage.incrementStat(key).catch(() => {});
  };

  const currentBusiness = useMemo(() => {
    if (route.name !== 'business') return null;
    return businesses.find((b) => b.id === route.id) || null;
  }, [route, businesses]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#1565C0]" />
          <p className="mt-3 text-sm text-slate-500">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar current={route.name} onNavigate={(r) => navigate(r)} user={user} business={business} isAdmin={isAdmin} onSignOut={() => { /* handled in navbar */ }} />
      <main className="flex-1">
        {route.name === 'home' && (
          <HomePage businesses={businesses} jobsCount={jobs.length} events={events} onOpenBusiness={openBusiness} onNavigate={navigate} />
        )}
        {route.name === 'directory' && (
          <DirectoryPage
            businesses={businesses}
            onOpenBusiness={openBusiness}
            initialQuery={route.query}
            initialMuni={route.muni}
            initialCategory={route.category}
          />
        )}
        {route.name === 'register' && (
          <RegisterPage onRegistered={(b) => { refreshBusinesses(); openBusiness(b); }} />
        )}
        {route.name === 'login' && (
          <AuthPage mode="login" onSuccess={() => navigate('dashboard')} onSwitch={() => navigate('register')} />
        )}
        {route.name === 'dashboard' && user && business && (
          <DashboardPage business={business} onNavigate={navigate} onRefresh={refreshBusinesses} />
        )}
        {route.name === 'dashboard' && (!user || !business) && (
          <AuthPage mode="login" onSuccess={() => navigate('dashboard')} onSwitch={() => navigate('register')} />
        )}
        {route.name === 'business' && currentBusiness && (
          <BusinessDetailPage business={currentBusiness} onBack={() => navigate('directory')} onTrack={track} onJobsChange={refreshJobs} />
        )}
        {route.name === 'business' && !currentBusiness && (
          <div className="mx-auto max-w-md px-4 py-20 text-center">
            <p className="text-lg font-bold text-slate-700">Negocio no encontrado</p>
            <button onClick={() => navigate('directory')} className="btn-primary mt-4">Ver directorio</button>
          </div>
        )}
        {route.name === 'jobs' && (
          <JobsPage jobs={jobs} savedJobs={savedJobs} onToggleSave={toggleSaveJob} onChange={refreshJobs} />
        )}
        {route.name === 'events' && (
          <EventsPage events={events} onChange={refreshEvents} />
        )}
        {route.name === 'qr' && <QRPage onTrack={track} />}
        {route.name === 'admin' && <AdminPage businesses={businesses} onChange={refreshBusinesses} />}
        {route.name === 'plans' && <PlansPage totalBusinesses={businesses.length} />}
      </main>
      <Footer onNavigate={navigate} />
      <InstallBanner />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ToastProvider>
  );
}
