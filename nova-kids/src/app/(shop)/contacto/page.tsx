import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ContactForm } from "@/components/checkout/contact-form";
import { WhatsAppIcon } from "@/components/ui/social-icons";
import { store } from "@/config/store";

export const metadata: Metadata = { title: "Contacto", description: "Escríbenos: con gusto te ayudamos con tallas, pedidos y envíos.", alternates: { canonical: "/contacto" } };

export default function ContactPage() {
  const c = store.contact;
  return (
    <>
      <PageHeader eyebrow="Estamos para ayudarte" title="Contacto" description="¿Dudas con tallas, pedidos o envíos? Escríbenos y te respondemos lo antes posible." />
      <div className="mx-auto grid max-w-5xl gap-8 px-4 pt-10 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
        <ul className="space-y-3">
          <ContactItem Icon={Mail} label="Correo" value={c.email} href={`mailto:${c.email}`} />
          {c.whatsapp && <ContactItem Icon={WhatsAppIcon} label="WhatsApp" value="Enviar mensaje" href={`https://wa.me/${c.whatsapp}`} />}
          {c.phone && <ContactItem Icon={Phone} label="Teléfono" value={c.phone} href={`tel:${c.phone}`} />}
          <ContactItem Icon={Clock} label="Horario" value={c.hours} />
          <ContactItem Icon={MapPin} label="Ubicación" value={c.address} />
        </ul>
        <ContactForm email={c.email} whatsapp={c.whatsapp} />
      </div>
    </>
  );
}

function ContactItem({ Icon, label, value, href }: { Icon: React.ComponentType<{ className?: string }>; label: string; value: string; href?: string }) {
  const inner = (
    <>
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10">
        <Icon className="size-5 text-nova-cyan" />
      </span>
      <span>
        <span className="block text-xs text-ink-faint">{label}</span>
        <span className="block text-white">{value}</span>
      </span>
    </>
  );
  return (
    <li>
      {href ? (
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="surface flex items-center gap-4 p-4 transition hover:border-white/20">
          {inner}
        </a>
      ) : (
        <div className="surface flex items-center gap-4 p-4">{inner}</div>
      )}
    </li>
  );
}
