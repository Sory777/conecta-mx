import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useSubscription } from '../lib/useSubscription';
import { useProfile } from '../lib/useProfile';

const tabs = [
  { to: '/dashboard', label: 'Mapa' },
  { to: '/vehicles', label: 'Vehículos' },
  { to: '/billing', label: 'Facturación' },
];

export function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const { subscription } = useSubscription();
  const { isAdmin } = useProfile();

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;

  const blocked = subscription && ['past_due', 'expired', 'canceled'].includes(subscription.status);
  const visibleTabs = isAdmin ? [...tabs, { to: '/admin', label: 'Admin' }] : tabs;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold">GPS Flotilla</span>
          <nav className="flex gap-4 text-sm">
            {visibleTabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  isActive ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-800'
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <button onClick={() => signOut()} className="text-sm text-gray-500 hover:text-gray-800">
          Cerrar sesión
        </button>
      </header>

      {blocked && (
        <div className="bg-amber-100 text-amber-800 text-sm px-4 py-2 text-center">
          Tu suscripción está {subscription?.status === 'expired' ? 'vencida' : 'con pago pendiente'}: el
          rastreo de tus vehículos está pausado.{' '}
          <NavLink to="/billing" className="underline font-medium">
            Ir a facturación
          </NavLink>
        </div>
      )}

      <main className="flex-1 min-h-0">
        <Outlet />
      </main>
    </div>
  );
}
