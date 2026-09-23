import { useState } from 'react';
import { FileText, ShieldCheck, AlertTriangle } from 'lucide-react';

type Tab = 'terms' | 'privacy';

export function LegalPage({ initialTab = 'terms' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl mng-gradient text-white">
          {tab === 'terms' ? <FileText className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
        </div>
        <h1 className="text-2xl font-extrabold text-slate-800">
          {tab === 'terms' ? 'Términos y Condiciones' : 'Aviso de Privacidad'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Última actualización: 23 de septiembre de 2026</p>
      </div>

      <div className="mb-5 flex justify-center gap-2">
        <button onClick={() => setTab('terms')} className={`btn text-sm ${tab === 'terms' ? 'btn-primary' : 'btn-outline'}`}>
          <FileText className="h-4 w-4" /> Términos y Condiciones
        </button>
        <button onClick={() => setTab('privacy')} className={`btn text-sm ${tab === 'privacy' ? 'btn-primary' : 'btn-outline'}`}>
          <ShieldCheck className="h-4 w-4" /> Aviso de Privacidad
        </button>
      </div>

      <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-amber-50 p-3.5 text-xs text-amber-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Este documento es una plantilla estándar generada para poner en marcha la plataforma. No sustituye la
          revisión de un abogado. Se recomienda que un profesional en derecho digital y protección de datos lo
          revise antes de una promoción masiva o comercial de gran escala.
        </p>
      </div>

      <div className="card space-y-5 p-6 text-sm leading-relaxed text-slate-700">
        {tab === 'terms' ? <TermsContent /> : <PrivacyContent />}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-bold text-slate-800">{title}</h2>
      <div className="space-y-2 text-slate-600">{children}</div>
    </section>
  );
}

function TermsContent() {
  return (
    <>
      <Section title="1. Aceptación de los términos">
        <p>
          Al registrar un negocio, reclamar una ficha, publicar contenido o utilizar cualquier función de Conecta MX
          ("la Plataforma", "nosotros"), aceptas estos Términos y Condiciones en su totalidad. Si no estás de acuerdo,
          no debes utilizar la Plataforma.
        </p>
      </Section>

      <Section title="2. Qué es Conecta MX">
        <p>
          Conecta MX es un directorio digital gratuito de negocios, bolsa de empleo y herramientas de promoción
          (códigos QR, publicaciones, planes de mayor visibilidad) para comercios en México. Conecta MX no es parte
          de ninguna transacción entre usuarios y negocios: solo facilita el contacto.
        </p>
      </Section>

      <Section title="3. Registro y veracidad de la información">
        <p>
          Quien registra o reclama un negocio declara ser el dueño, representante legal o persona autorizada para
          administrar su información, y es responsable de que los datos publicados (nombre, dirección, teléfono,
          horarios, fotos, promociones) sean verídicos y estén actualizados.
        </p>
        <p>
          Conecta MX se reserva el derecho de solicitar comprobación adicional (identificación, comprobante del
          negocio) antes de aprobar un reclamo, de rechazar solicitudes que parezcan fraudulentas, y de suspender o
          eliminar cualquier ficha que contenga información falsa, ofensiva o que infrinja derechos de terceros.
        </p>
      </Section>

      <Section title="4. Reclamo de negocios existentes">
        <p>
          Muchos negocios en el directorio provienen de fuentes públicas (como el DENUE del INEGI) y no han sido
          registrados directamente por su dueño. Cualquier persona puede solicitar el reclamo de una ficha sin
          dueño asignado; la aprobación queda a criterio del equipo administrador de Conecta MX, quien podrá
          rechazar o revertir un reclamo si se comprueba que no corresponde al titular real del negocio.
        </p>
      </Section>

      <Section title="5. Contenido generado por usuarios">
        <p>
          Reseñas, calificaciones, fotos y publicaciones deben corresponder a experiencias reales y no deben
          contener contenido difamatorio, discriminatorio, falso o ilegal. Conecta MX puede eliminar, sin previo
          aviso, cualquier contenido que incumpla esta regla o que sea reportado y confirmado como inapropiado.
        </p>
      </Section>

      <Section title="6. Planes, publicidad y pagos">
        <p>
          Conecta MX ofrece planes gratuitos y de pago con distintos niveles de visibilidad, así como espacios
          publicitarios (incluido el video de bienvenida al ingresar a la app) que pueden contratarse por separado.
          Estos planes no garantizan un número determinado de clientes, ventas o resultados: solo ofrecen mayor
          exposición dentro de la Plataforma.
        </p>
      </Section>

      <Section title="7. Propiedad intelectual">
        <p>
          El diseño, código, logotipo y marca "Conecta MX" son propiedad de sus creadores. El contenido que cada
          negocio sube (fotos, descripciones) sigue siendo propiedad de quien lo publica, quien otorga a Conecta MX
          una licencia no exclusiva para mostrarlo dentro de la Plataforma.
        </p>
      </Section>

      <Section title="8. Limitación de responsabilidad">
        <p>
          Conecta MX no garantiza la exactitud de la información publicada por terceros, ni es responsable por
          disputas, fraudes, productos, servicios o comunicaciones entre usuarios y negocios listados. El uso de la
          Plataforma es bajo tu propio riesgo.
        </p>
      </Section>

      <Section title="9. Modificaciones">
        <p>
          Estos Términos pueden actualizarse en cualquier momento; los cambios entran en vigor al publicarse en esta
          misma página. El uso continuado de la Plataforma después de un cambio implica su aceptación.
        </p>
      </Section>

      <Section title="10. Ley aplicable">
        <p>
          Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia se someterá
          a los tribunales competentes del estado de Guanajuato, salvo que la ley disponga otra jurisdicción
          obligatoria.
        </p>
      </Section>

      <Section title="11. Contacto">
        <p>Dudas o reportes: <a className="text-[#1565C0] hover:underline" href="mailto:contacto@conectamx.app">contacto@conectamx.app</a></p>
      </Section>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <Section title="Responsable del tratamiento de datos">
        <p>
          Conecta MX es responsable del tratamiento de los datos personales que nos proporcionas al usar la
          Plataforma, de conformidad con la Ley Federal de Protección de Datos Personales en Posesión de los
          Particulares (LFPDPPP).
        </p>
      </Section>

      <Section title="Datos que recabamos">
        <ul className="ml-4 list-disc space-y-1">
          <li>Datos de contacto: nombre, correo electrónico, número de teléfono/WhatsApp.</li>
          <li>Datos del negocio: dirección, categoría, descripción, horarios, fotografías.</li>
          <li>Ubicación geográfica (GPS), solo cuando el usuario decide compartirla activamente.</li>
          <li>Datos de uso: páginas visitadas, clics en WhatsApp o "Cómo llegar", con fines estadísticos.</li>
        </ul>
      </Section>

      <Section title="Finalidades del tratamiento">
        <p><strong>Finalidades primarias (necesarias para el servicio):</strong> operar el directorio, verificar solicitudes de reclamo de negocios, permitir contacto entre usuarios y negocios, publicar vacantes y currículums, y generar códigos QR.</p>
        <p><strong>Finalidades secundarias (opcionales):</strong> enviarte novedades sobre la Plataforma. Puedes oponerte a estas en cualquier momento escribiendo al correo de contacto.</p>
      </Section>

      <Section title="Con quién compartimos tus datos">
        <p>
          Utilizamos proveedores externos para operar la Plataforma (como Supabase para almacenamiento de base de
          datos, y Cloudflare para hospedaje). Estos proveedores procesan datos en nuestro nombre y bajo nuestras
          instrucciones. No vendemos datos personales a terceros con fines de mercadotecnia ajenos a Conecta MX.
        </p>
        <p>
          El número de WhatsApp y demás datos de contacto que un negocio decide publicar son visibles públicamente
          para cualquier visitante de la Plataforma, ya que ese es el propósito del directorio.
        </p>
      </Section>

      <Section title="Derechos ARCO">
        <p>
          Tienes derecho a Acceder, Rectificar, Cancelar u Oponerte (derechos ARCO) al tratamiento de tus datos
          personales, así como a revocar tu consentimiento en cualquier momento. Para ejercerlos, escribe a{' '}
          <a className="text-[#1565C0] hover:underline" href="mailto:contacto@conectamx.app">contacto@conectamx.app</a>{' '}
          indicando tu nombre, el negocio o cuenta relacionada, y el derecho que deseas ejercer.
        </p>
      </Section>

      <Section title="Conservación y seguridad">
        <p>
          Conservamos tus datos mientras tu negocio o cuenta permanezca activo en la Plataforma, o mientras sea
          necesario para cumplir una obligación legal. Aplicamos medidas de seguridad razonables para proteger tu
          información contra acceso no autorizado.
        </p>
      </Section>

      <Section title="Uso de cookies y almacenamiento local">
        <p>
          La Plataforma utiliza almacenamiento local del navegador (localStorage) para recordar preferencias como
          negocios guardados o el identificador de visitante anónimo usado en estadísticas, sin identificarte
          personalmente.
        </p>
      </Section>

      <Section title="Cambios a este aviso">
        <p>
          Este Aviso de Privacidad puede actualizarse; cualquier cambio se publicará en esta misma página con su
          fecha de actualización.
        </p>
      </Section>
    </>
  );
}
