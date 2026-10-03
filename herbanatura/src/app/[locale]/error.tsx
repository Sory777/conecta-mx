'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-serif text-3xl font-semibold">Ocurrió un error</h1>
      <p className="mt-2 text-muted">Intenta de nuevo. Si el problema continúa, vuelve más tarde.</p>
      <button onClick={reset} className="mt-6 rounded-full bg-accent px-5 py-2 font-semibold text-white">Reintentar</button>
    </div>
  );
}
