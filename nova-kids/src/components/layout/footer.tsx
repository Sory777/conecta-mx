import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { store } from "@/config/store";
import { FacebookIcon, InstagramIcon, TikTokIcon, YouTubeIcon } from "@/components/ui/social-icons";
import { Logo } from "./logo";

const COLUMNS = [
  {
    title: "Tienda",
    links: [
      { href: "/catalogo", label: "Catálogo" },
      { href: "/novedades", label: "Novedades" },
      { href: "/ofertas", label: "Ofertas" },
      { href: "/favoritos", label: "Favoritos" },
    ],
  },
  {
    title: "NOVA KIDS",
    links: [
      { href: "/nosotros", label: "Nosotros" },
      { href: "/contacto", label: "Contacto" },
      { href: "/preguntas-frecuentes", label: "Preguntas frecuentes" },
      { href: "/cuenta", label: "Consultar mi pedido" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { href: "/envios", label: "Envíos" },
      { href: "/devoluciones", label: "Devoluciones" },
      { href: "/privacidad", label: "Política de privacidad" },
      { href: "/terminos", label: "Términos y condiciones" },
    ],
  },
];

const SOCIAL = [
  { key: "instagram", label: "Instagram", Icon: InstagramIcon },
  { key: "facebook", label: "Facebook", Icon: FacebookIcon },
  { key: "tiktok", label: "TikTok", Icon: TikTokIcon },
  { key: "youtube", label: "YouTube", Icon: YouTubeIcon },
] as const;

export function Footer() {
  return (
    <footer className="relative mt-24 overflow-hidden border-t border-white/8 bg-space-950">
      <div className="starfield opacity-40" aria-hidden />
      <div className="bg-nova-gradient absolute inset-x-0 top-0 h-px opacity-60" aria-hidden />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[60rem] -translate-x-1/2 rounded-full bg-nova-purple/10 blur-3xl" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-8 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <Logo width={170} />
            <p className="mt-5 max-w-sm font-display text-lg text-white">{store.tagline}</p>
            <p className="text-nova-gradient mt-3 font-display text-sm font-bold tracking-[0.3em]">{store.motto}</p>
            <ul className="mt-6 space-y-2 text-sm text-ink-muted">
              <li className="flex items-center gap-2">
                <Mail className="size-4 text-nova-cyan" />
                <a href={`mailto:${store.contact.email}`} className="hover:text-white">{store.contact.email}</a>
              </li>
              {store.contact.phone && (
                <li className="flex items-center gap-2">
                  <Phone className="size-4 text-nova-cyan" />
                  <a href={`tel:${store.contact.phone}`} className="hover:text-white">{store.contact.phone}</a>
                </li>
              )}
              <li className="flex items-center gap-2">
                <MapPin className="size-4 text-nova-cyan" /> {store.contact.address}
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="font-display text-xs font-semibold tracking-[0.25em] text-white uppercase">{col.title}</h3>
                <ul className="mt-4 space-y-3 text-sm">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-ink-muted transition hover:text-nova-cyan">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col-reverse items-start justify-between gap-6 border-t border-white/8 pt-6 sm:flex-row sm:items-center">
          <p className="text-ink-faint text-xs">
            © {new Date().getFullYear()} {store.name}. Todos los derechos reservados.
          </p>
          <div className="flex gap-2">
            {SOCIAL.filter((s) => store.social[s.key]).map(({ key, label, Icon }) => (
              <a
                key={key}
                href={store.social[key]}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="grid size-10 place-items-center rounded-full border border-white/10 text-ink-muted transition hover:border-nova-cyan/50 hover:text-white hover:shadow-[0_0_18px_-4px_var(--color-nova-cyan)]"
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
