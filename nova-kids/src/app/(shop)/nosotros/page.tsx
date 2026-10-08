import type { Metadata } from "next";
import Link from "next/link";
import { Rocket, Sparkles, Star, Orbit } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Logo } from "@/components/layout/logo";
import { store } from "@/config/store";

export const metadata: Metadata = { title: "Nosotros", description: store.description, alternates: { canonical: "/nosotros" } };

const VALUES = [
  { Icon: Rocket, title: "Exploración", text: "Prendas que acompañan cada aventura, del parque a la escuela." },
  { Icon: Star, title: "Imaginación", text: "Diseños propios inspirados en el espacio y en los sueños de los niños." },
  { Icon: Orbit, title: "Comodidad", text: "Telas suaves, costuras planas y cortes que dejan moverse con libertad." },
  { Icon: Sparkles, title: "Calidad", text: "Materiales resistentes que aguantan juegos, lavadas y crecimiento." },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="Nuestra misión" title="Nosotros" description={store.tagline} />
      <div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6">
        <div className="grid items-center gap-10 md:grid-cols-[1fr_1.2fr]">
          <div className="surface relative grid aspect-square place-items-center overflow-hidden p-10">
            <div className="starfield" aria-hidden />
            <div className="absolute size-3/4 rounded-full bg-nova-purple/20 blur-3xl" aria-hidden />
            <Logo width={320} href={null} className="relative max-w-full" />
          </div>
          <div className="space-y-4 text-lg leading-relaxed text-ink-muted">
            <p className="text-nova-gradient font-display text-sm font-bold tracking-[0.35em]">{store.motto}</p>
            <p>
              <strong className="text-white">NOVA KIDS</strong> nace de una idea sencilla: la ropa de los niños también puede despertar su
              imaginación. Cada prenda está pensada para explorar, jugar y crecer con estilo.
            </p>
            <p>
              Diseñamos colecciones con identidad propia —cohetes, órbitas y estrellas— sin sacrificar lo más importante: comodidad,
              calidad y prendas fáciles de combinar para mamás y papás.
            </p>
            <Link href="/catalogo" className="btn btn-primary mt-2">
              <Rocket className="rocket-icon size-4" /> Explorar catálogo
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-2">
          {VALUES.map(({ Icon, title, text }) => (
            <div key={title} className="surface p-6">
              <span className="bg-nova-gradient grid size-11 place-items-center rounded-xl">
                <Icon className="size-5 text-white" />
              </span>
              <h2 className="mt-4 font-display text-lg font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-ink-muted">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
