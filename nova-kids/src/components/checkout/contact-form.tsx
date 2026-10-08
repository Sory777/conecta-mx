"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/social-icons";

/** Abre el correo (o WhatsApp) del cliente con el mensaje ya redactado. No requiere servidor de correo. */
export function ContactForm({ email, whatsapp }: { email: string; whatsapp: string }) {
  const [name, setName] = useState("");
  const [order, setOrder] = useState("");
  const [message, setMessage] = useState("");

  const body = `Hola NOVA KIDS, soy ${name}.${order ? ` Mi pedido es ${order}.` : ""}\n\n${message}`;

  function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(`Contacto web — ${name}`)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form onSubmit={sendEmail} className="surface space-y-4 p-6">
      <h2 className="font-display text-lg font-semibold">Envíanos un mensaje</h2>
      <div>
        <label htmlFor="c-name" className="label">Nombre</label>
        <input id="c-name" required className="field" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="c-order" className="label">Número de pedido (opcional)</label>
        <input id="c-order" className="field uppercase" placeholder="NK-001001" value={order} onChange={(e) => setOrder(e.target.value.toUpperCase())} />
      </div>
      <div>
        <label htmlFor="c-msg" className="label">Mensaje</label>
        <textarea id="c-msg" required rows={5} className="field" value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" className="btn btn-primary flex-1">
          <Send className="size-4" /> Enviar por correo
        </button>
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(body)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary flex-1"
          >
            <WhatsAppIcon className="size-4" /> WhatsApp
          </a>
        )}
      </div>
    </form>
  );
}
