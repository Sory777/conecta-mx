import Link from "next/link";
import { Rocket } from "lucide-react";

export function NotFoundContent() {
  return (
    <div className="relative mx-auto flex max-w-xl flex-col items-center px-4 pt-20 text-center">
      <p className="text-nova-gradient font-display text-8xl font-extrabold">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold">Esta página se perdió en el espacio</h1>
      <p className="mt-2 text-ink-muted">Puede que el producto ya no esté disponible o que la dirección haya cambiado.</p>
      <Link href="/catalogo" className="btn btn-primary mt-8">
        <Rocket className="rocket-icon size-4" /> Volver al catálogo
      </Link>
    </div>
  );
}
