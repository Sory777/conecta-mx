"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Heart, Loader2, LogOut, PackageSearch, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useStore } from "@/components/store/store-provider";
import { authClient, authEnabled } from "@/lib/auth/client";

export function AccountPanel() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <OrderLookup />
      <div className="space-y-6">
        <AuthBox />
        <FavoritesBox />
      </div>
    </div>
  );
}

function OrderLookup() {
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/orders/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number, email }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    router.push(`/pedido/${data.id}`);
  }

  return (
    <form onSubmit={submit} className="surface space-y-4 p-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <PackageSearch className="size-5 text-nova-cyan" /> Consultar estado del pedido
      </h2>
      <p className="text-sm text-ink-muted">Escribe el número de pedido (ej. NK-001001) y el correo con el que compraste.</p>
      <div>
        <label htmlFor="ord" className="label">Número de pedido</label>
        <input id="ord" required className="field uppercase" placeholder="NK-001001" value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())} />
      </div>
      <div>
        <label htmlFor="ordmail" className="label">Correo electrónico</label>
        <input id="ordmail" required type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <button type="submit" disabled={loading} className="btn btn-primary w-full">
        {loading && <Loader2 className="size-4 animate-spin" />} Consultar pedido
      </button>
    </form>
  );
}

function FavoritesBox() {
  const { favorites, hydrated } = useStore();
  return (
    <Link href="/favoritos" className="surface flex items-center gap-4 p-6 transition hover:border-white/20">
      <span className="grid size-12 place-items-center rounded-full bg-nova-magenta/15">
        <Heart className="size-5 text-nova-magenta" />
      </span>
      <span>
        <span className="block font-display font-semibold">Mis favoritos</span>
        <span className="text-sm text-ink-muted">{hydrated ? `${favorites.length} guardados` : "…"}</span>
      </span>
    </Link>
  );
}

function AuthBox() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const client = authClient();

  useEffect(() => {
    if (!client) return;
    client.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = client.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [client]);

  if (!authEnabled() || !client) {
    return (
      <div className="surface p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <UserRound className="size-5 text-nova-cyan" /> Cuentas de cliente
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Muy pronto podrás crear tu cuenta para guardar direcciones y ver tu historial. Mientras tanto, puedes comprar como invitado y
          consultar cualquier pedido con su número y tu correo.
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    setLoading(true);
    setMsg(null);
    const res =
      mode === "login"
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/cuenta` } });
    setLoading(false);
    if (res.error) return setMsg({ text: res.error.message, ok: false });
    if (mode === "register" && !res.data.session) setMsg({ text: "Revisa tu correo para confirmar tu cuenta.", ok: true });
  }

  if (user) {
    return (
      <div className="surface p-6">
        <h2 className="font-display text-lg font-semibold">¡Hola de nuevo!</h2>
        <p className="mt-1 text-sm text-ink-muted">{user.email}</p>
        <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => client.auth.signOut()}>
          <LogOut className="size-4" /> Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="surface space-y-4 p-6">
      <div className="flex gap-2">
        <button type="button" className={`chip ${mode === "login" ? "is-active" : ""}`} onClick={() => setMode("login")}>
          Iniciar sesión
        </button>
        <button type="button" className={`chip ${mode === "register" ? "is-active" : ""}`} onClick={() => setMode("register")}>
          Crear cuenta
        </button>
      </div>
      <div>
        <label htmlFor="acc-mail" className="label">Correo</label>
        <input id="acc-mail" type="email" required autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label htmlFor="acc-pass" className="label">Contraseña</label>
        <input id="acc-pass" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
      <button type="submit" disabled={loading} className="btn btn-primary w-full">
        {loading && <Loader2 className="size-4 animate-spin" />} {mode === "login" ? "Entrar" : "Crear cuenta"}
      </button>
    </form>
  );
}
