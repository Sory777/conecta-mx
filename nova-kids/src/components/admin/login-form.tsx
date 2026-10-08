"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";

export function LoginForm({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.href = next;
      return;
    }
    setError((await res.json().catch(() => ({}))).error ?? "No se pudo iniciar sesión.");
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="pw" className="label">Contraseña</label>
        <input id="pw" type="password" required autoFocus autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <button type="submit" disabled={loading} className="btn btn-primary w-full">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />} Entrar
      </button>
    </form>
  );
}
