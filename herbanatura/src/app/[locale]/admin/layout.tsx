import Link from 'next/link';
import type { ReactNode } from 'react';
import { adminAccess } from '@/lib/admin/guard';
import { pageContext } from '@/lib/i18n/server';
import { Container, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administración', robots: { index: false } };

const NAV: [string, string][] = [
  ['', 'Resumen'],
  ['/revision', '🟡 Revisión'],
  ['/contenido', 'Contenido'],
  ['/evidencia', 'Nueva evidencia'],
  ['/interacciones', 'Nueva interacción'],
  ['/estudios', 'Estudios'],
  ['/fuentes', 'Fuentes'],
  ['/literatura', 'Literatura nueva'],
  ['/auditoria', 'Auditoría'],
];

export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await pageContext(params);
  const access = await adminAccess();
  return (
    <Container className="py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-serif text-3xl font-semibold">🛠️ Panel editorial</h1>
        {access.kind === 'staff' && <p className="text-sm text-muted">{access.session.email} · rol: {access.session.staffRole}</p>}
      </div>
      {access.kind === 'demo' && (
        <div className="mt-4">
          <Notice tone="warn" title="Modo demostración (sólo lectura)">
            Sin Supabase configurado el panel muestra el conjunto demostrativo y los formularios están desactivados. Configura las variables de entorno y asigna un rol en <code>admin_users</code> para editar.
          </Notice>
        </div>
      )}
      {(access.kind === 'anonymous' || access.kind === 'forbidden') ? (
        <div className="mt-6">
          <Notice tone="danger" title="Acceso restringido">
            {access.kind === 'anonymous' ? (
              <>Inicia sesión con una cuenta de personal editorial. <Link className="underline" href={`/${locale}/entrar`}>Entrar →</Link></>
            ) : (
              'Tu cuenta no tiene rol editorial. Un administrador debe asignártelo.'
            )}
          </Notice>
        </div>
      ) : (
        <>
          <nav className="mt-4 flex flex-wrap gap-1 border-b border-border pb-3 text-sm">
            {NAV.map(([href, label]) => (
              <Link key={href} href={`/${locale}/admin${href}`} className="rounded-lg px-3 py-1.5 hover:bg-surface-2">
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-6">{children}</div>
        </>
      )}
    </Container>
  );
}
