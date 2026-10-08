import { Logo } from "@/components/layout/logo";
import { LoginForm } from "@/components/admin/login-form";
import { adminConfigured } from "@/lib/admin-session";

export const metadata = { title: "Acceso" };

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="relative grid min-h-screen place-items-center px-4">
      <div className="starfield" aria-hidden />
      <div className="surface relative w-full max-w-sm p-8">
        <Logo width={150} className="mx-auto block" href="/" />
        <h1 className="mt-6 text-center font-display text-xl font-semibold">Panel administrativo</h1>
        {adminConfigured() ? (
          <LoginForm next={next?.startsWith("/admin") ? next : "/admin"} />
        ) : (
          <p className="mt-4 rounded-xl bg-warning/10 p-4 text-sm text-warning">
            El panel está desactivado. Define <code className="font-mono">ADMIN_PASSWORD</code> y{" "}
            <code className="font-mono">ADMIN_SESSION_SECRET</code> en tu archivo <code className="font-mono">.env.local</code> y reinicia el servidor.
          </p>
        )}
      </div>
    </div>
  );
}
