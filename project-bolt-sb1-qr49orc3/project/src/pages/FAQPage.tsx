import { useState } from 'react';
import { HelpCircle, ChevronDown, MessageCircle } from 'lucide-react';

interface FAQPageProps {
  onNavigate: (route: string) => void;
}

interface FAQItem {
  q: string;
  a: string;
}

const FAQS: FAQItem[] = [
  {
    q: '¿Cómo registro mi negocio?',
    a: 'Toca "Registrar Negocio" en la página principal y llena el formulario con tus datos. El registro en el plan Gratis no tiene costo.',
  },
  {
    q: 'Mi negocio ya aparece en el directorio pero yo no lo registré, ¿qué hago?',
    a: 'Muchos negocios vienen de un directorio público del gobierno (INEGI), así que puede que el tuyo ya esté ahí sin que lo hayas registrado tú. Ábrelo y toca "¿Es tu negocio? Reclámalo" para pedir que se vincule a tu cuenta y puedas administrarlo.',
  },
  {
    q: '¿Cómo reclamo mi negocio y qué documentos necesito?',
    a: 'Primero necesitas iniciar sesión o crear una cuenta. Luego, desde la página de tu negocio, toca "Reclámalo" y sube una foto de tu identificación oficial (INE, licencia, etc.) y, si tienes, un comprobante de que el negocio es tuyo (un recibo, una factura, o una foto tuya frente al negocio con el letrero visible). Un administrador revisa la solicitud y te contacta al correo de tu cuenta.',
  },
  {
    q: '¿Cuánto tarda la verificación de mi reclamo?',
    a: 'Un administrador revisa cada solicitud manualmente para confirmar que de verdad eres el dueño, así que puede tardar uno o varios días dependiendo del volumen de solicitudes.',
  },
  {
    q: '¿Cuánto cuesta usar Conecta MX?',
    a: 'El plan Gratis no tiene costo y ya incluye lo básico para aparecer en el directorio. Hay planes de paga (Destacado y Premium) con más fotos, más publicaciones y mayor visibilidad. Revisa la sección "Planes" para ver el detalle.',
  },
  {
    q: '¿Qué es "Negocio Fundador"?',
    a: 'Los primeros negocios en registrarse reciben el plan Destacado gratis para siempre, como agradecimiento por unirse desde el inicio.',
  },
  {
    q: '¿Cómo subo fotos de mi negocio?',
    a: 'Desde tu panel (después de iniciar sesión o reclamar tu negocio), en la sección de fotos puedes subir imágenes de tu espacio. El número de fotos permitidas depende de tu plan.',
  },
  {
    q: '¿Cómo publico una vacante de empleo?',
    a: 'Desde la página de tu negocio, en la sección "Vacantes de empleo", toca "Publicar vacante" y llena los datos del puesto.',
  },
  {
    q: '¿Cómo genero el código QR de mi negocio?',
    a: 'Ve a la sección "Código QR" desde el menú principal para generar y descargar un QR que lleva directo al perfil de tu negocio — puedes imprimirlo y ponerlo en tu local.',
  },
  {
    q: '¿Mis datos y los documentos que subo están seguros?',
    a: 'Los documentos que subes para verificar tu negocio (identificación, comprobantes) solo los puede ver un administrador para revisarlos, no se muestran públicamente. Puedes leer más en el Aviso de Privacidad.',
  },
  {
    q: '¿Cómo contacto soporte si tengo un problema?',
    a: 'Escríbenos a contacto@conectamx.app y con gusto te ayudamos.',
  },
];

export function FAQPage({ onNavigate }: FAQPageProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl mng-gradient text-white">
          <HelpCircle className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-800">Preguntas frecuentes</h1>
        <p className="mt-1 text-sm text-slate-500">Resuelve tus dudas sobre Conecta MX</p>
      </div>

      <div className="space-y-2.5">
        {FAQS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={item.q} className="card overflow-hidden p-0">
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
              >
                <span className="text-sm font-semibold text-slate-800">{item.q}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <p className="px-4 pb-4 text-sm leading-relaxed text-slate-600">{item.a}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl bg-slate-50 p-5 text-center">
        <MessageCircle className="h-6 w-6 text-[#1565C0]" />
        <p className="text-sm font-semibold text-slate-700">¿No encontraste lo que buscabas?</p>
        <p className="text-xs text-slate-500">Escríbenos a contacto@conectamx.app</p>
        <button onClick={() => onNavigate('home')} className="btn-outline mt-2 text-xs">Volver al inicio</button>
      </div>
    </div>
  );
}
