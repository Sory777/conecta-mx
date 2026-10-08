import { shippingMethods, store } from "@/config/store";
import type { ProseSection } from "@/components/ui/prose-page";

// Textos base de las páginas informativas. Revísalos con tu asesor legal antes de publicar.

const shippingLines = shippingMethods.map(
  (m) => `${m.label}: ${m.description}. ${m.price === 0 ? "Sin costo." : `Costo: $${m.price} MXN${m.freeFrom ? `, gratis en compras desde $${m.freeFrom} MXN` : ""}.`}`,
);

export const pages: Record<string, { title: string; description: string; sections: ProseSection[] }> = {
  envios: {
    title: "Envíos",
    description: "Enviamos a todo México con seguimiento.",
    sections: [
      { title: "Métodos y costos", body: shippingLines },
      { title: "Tiempos de preparación", body: ["Preparamos tu pedido en 1 a 2 días hábiles después de confirmar el pago. Recibirás tu número de guía por correo cuando salga de nuestra estación."] },
      { title: "Seguimiento", body: ["Puedes consultar el estado de tu pedido en cualquier momento desde Mi cuenta con tu número de pedido y correo."] },
    ],
  },
  devoluciones: {
    title: "Cambios y devoluciones",
    description: "Queremos que cada prenda le quede perfecta.",
    sections: [
      { title: "Cambios de talla", body: ["Tienes 30 días naturales a partir de que recibes tu pedido para solicitar un cambio de talla o color, sujeto a disponibilidad.", "La prenda debe estar sin uso, sin lavar y con sus etiquetas originales."] },
      { title: "Devoluciones", body: ["Si la prenda presenta un defecto de fabricación, te reembolsamos o la reemplazamos sin costo.", `Para iniciar un cambio o devolución escríbenos a ${store.contact.email} con tu número de pedido.`] },
    ],
  },
  privacidad: {
    title: "Aviso de privacidad",
    description: "Cómo cuidamos tus datos personales.",
    sections: [
      { title: "Responsable", body: [`${store.name} es responsable del tratamiento de los datos personales que nos proporcionas al comprar o contactarnos.`] },
      { title: "Datos que recabamos", body: ["Nombre, teléfono, correo electrónico y dirección de envío, únicamente para procesar y entregar tus pedidos y darte atención."] },
      { title: "Pagos", body: ["Los datos de tarjeta se capturan directamente en la plataforma de pago (Mercado Pago, Stripe o PayPal). NOVA KIDS no almacena números de tarjeta."] },
      { title: "Derechos ARCO", body: [`Puedes solicitar el acceso, rectificación, cancelación u oposición al uso de tus datos escribiendo a ${store.contact.email}.`] },
    ],
  },
  terminos: {
    title: "Términos y condiciones",
    description: "Condiciones de uso y compra en la tienda NOVA KIDS.",
    sections: [
      { title: "Precios", body: [`Todos los precios están expresados en pesos mexicanos (${store.currency}) e incluyen IVA. Pueden cambiar sin previo aviso; se respeta el precio confirmado en tu pedido.`] },
      { title: "Disponibilidad", body: ["Los productos están sujetos a disponibilidad. Si un producto se agota después de tu compra, te contactaremos para ofrecerte un cambio o el reembolso."] },
      { title: "Pedidos", body: ["Un pedido se considera confirmado cuando se acredita el pago. Los pedidos con transferencia se apartan durante 48 horas."] },
    ],
  },
};
