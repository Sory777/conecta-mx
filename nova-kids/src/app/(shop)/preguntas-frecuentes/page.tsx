import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { shippingMethods } from "@/config/store";

export const metadata: Metadata = { title: "Preguntas frecuentes", alternates: { canonical: "/preguntas-frecuentes" } };

const freeFrom = shippingMethods.find((m) => m.freeFrom)?.freeFrom;

const FAQ = [
  { q: "¿Cómo elijo la talla correcta?", a: "Nuestras tallas corresponden a la edad en años (4, 6, 8, 10, 12…). Si tu peque está entre dos tallas, te recomendamos la mayor para que le dure más." },
  { q: "¿Cuánto tarda mi pedido?", a: "Preparamos tu pedido en 1 a 2 días hábiles. El envío estándar tarda de 3 a 6 días hábiles y el express de 1 a 2 días." },
  { q: "¿Cuánto cuesta el envío?", a: freeFrom ? `El envío estándar es gratis en compras desde $${freeFrom} MXN. Consulta todos los costos en la página de envíos.` : "Consulta los costos en la página de envíos." },
  { q: "¿Qué métodos de pago aceptan?", a: "Tarjeta de crédito o débito, Mercado Pago, PayPal y transferencia bancaria, según los métodos activos al momento de tu compra." },
  { q: "¿Puedo cambiar una prenda?", a: "Sí. Tienes 30 días para cambiar talla o color, siempre que la prenda esté sin uso y con etiquetas." },
  { q: "¿Cómo consulto el estado de mi pedido?", a: "Entra a Mi cuenta y escribe tu número de pedido y tu correo." },
];

export default function FaqPage() {
  return (
    <>
      <PageHeader eyebrow="Ayuda" title="Preguntas frecuentes" description="Todo lo que necesitas saber antes de despegar." />
      <div className="mx-auto max-w-3xl space-y-3 px-4 pt-10 sm:px-6">
        {FAQ.map((f) => (
          <details key={f.q} className="surface group p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display font-semibold text-white">
              {f.q}
              <ChevronDown className="size-5 shrink-0 text-nova-cyan transition group-open:rotate-180" />
            </summary>
            <p className="mt-3 leading-relaxed text-ink-muted">{f.a}</p>
          </details>
        ))}
        <p className="pt-6 text-center text-sm text-ink-muted">
          ¿No encontraste tu respuesta? <Link href="/contacto" className="text-nova-cyan hover:underline">Escríbenos</Link>
        </p>
      </div>
    </>
  );
}
