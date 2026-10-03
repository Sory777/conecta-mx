import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/pages/LegalPage';
import { pageContext } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'Términos de uso' };

const ES: LegalSection[] = [
  { h: '1. Naturaleza del servicio', p: ['HerbaNatura es una enciclopedia educativa. No presta servicios médicos, no diagnostica y no sustituye la consulta con profesionales de la salud.'] },
  { h: '2. Ninguna recomendación médica', p: ['La información sobre investigación, dosis estudiadas o usos tradicionales no constituye una recomendación de uso. No abandones, retrases ni modifiques un tratamiento prescrito — en particular un tratamiento contra el cáncer — basándote en esta aplicación.'] },
  { h: '3. Emergencias', p: ['Ante síntomas graves (dolor de pecho, dificultad para respirar, pérdida de conciencia, convulsiones, sangrado importante, reacción alérgica grave, síntomas neurológicos repentinos o posible intoxicación) llama al 911 o acude a urgencias.'] },
  { h: '4. Identificación de plantas', p: ['Las identificaciones por fotografía son preliminares y pueden ser erróneas. Nunca consumas una planta u hongo basándote únicamente en ellas.'] },
  { h: '5. Exactitud y fuentes', p: ['Citamos fuentes verificables y mostramos el estado de revisión de cada contenido. Aun así, el conocimiento científico cambia y puede haber errores; si detectas uno, repórtalo.'] },
  { h: '6. Propiedad intelectual', p: ['No reproducimos artículos protegidos por derechos de autor: sólo metadatos, resúmenes propios y enlaces a la fuente original. Las imágenes de terceros se muestran con su autor y licencia.'] },
  { h: '7. Uso aceptable', p: ['Queda prohibido el uso automatizado abusivo, el intento de acceso no autorizado y la extracción masiva de datos sin permiso.'] },
  { h: '8. Suscripciones', p: ['Las funciones premium se rigen por las condiciones mostradas al contratar. Ningún pago otorga influencia sobre el contenido científico.'] },
];

const EN: LegalSection[] = [
  { h: '1. Nature of the service', p: ['HerbaNatura is an educational encyclopedia. It does not provide medical services, does not diagnose and does not replace health professionals.'] },
  { h: '2. No medical advice', p: ['Information about research, studied doses or traditional uses is not a recommendation for use. Do not stop, delay or change a prescribed treatment — especially cancer treatment — based on this app.'] },
  { h: '3. Emergencies', p: ['For severe symptoms (chest pain, trouble breathing, loss of consciousness, seizures, heavy bleeding, severe allergic reaction, sudden neurological symptoms or possible poisoning) call 911 or go to the emergency department.'] },
  { h: '4. Plant identification', p: ['Photo identifications are preliminary and may be wrong. Never eat a plant or mushroom based only on them.'] },
  { h: '5. Accuracy and sources', p: ['We cite verifiable sources and show each item’s review status. Science changes and errors are possible; please report them.'] },
  { h: '6. Intellectual property', p: ['We do not reproduce copyrighted articles: only metadata, our own summaries and links to the original source. Third-party images are shown with author and license.'] },
  { h: '7. Acceptable use', p: ['Abusive automated use, unauthorized access attempts and bulk data extraction without permission are prohibited.'] },
  { h: '8. Subscriptions', p: ['Premium features are governed by the terms shown at purchase. No payment grants any influence over scientific content.'] },
];

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await pageContext(params);
  return (
    <LegalPage
      title={locale === 'es' ? 'Términos de uso' : 'Terms of use'}
      updated={locale === 'es' ? 'Versión 0.1 · 3 de octubre de 2026' : 'Version 0.1 · October 3, 2026'}
      reviewNote={locale === 'es' ? 'Borrador: debe revisarlo un profesional jurídico antes del lanzamiento.' : 'Draft: must be reviewed by a legal professional before launch.'}
      sections={locale === 'es' ? ES : EN}
    />
  );
}
