import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="text-5xl" aria-hidden>🌿</p>
      <h1 className="mt-4 font-serif text-3xl font-semibold">No encontramos esta página</h1>
      <p className="mt-2 text-muted">Puede que la ficha aún no exista o haya cambiado de dirección. / This page was not found.</p>
      <Link href="/es" className="mt-6 inline-block rounded-full bg-accent px-5 py-2 font-semibold text-white">HerbaNatura</Link>
    </div>
  );
}
