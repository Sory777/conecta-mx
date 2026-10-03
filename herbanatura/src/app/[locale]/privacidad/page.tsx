import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/pages/LegalPage';
import { pageContext } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'Política de privacidad' };

const ES: LegalSection[] = [
  { h: '1. Principio: mínimo de datos', p: ['HerbaNatura puede usarse sin cuenta. Por defecto, tus favoritos, historial, colecciones y perfil de salud se guardan únicamente en tu dispositivo (almacenamiento local del navegador) y no se envían a nuestros servidores.'] },
  { h: '2. Datos de salud (datos sensibles)', p: ['Edad (por rangos), sexo, embarazo, lactancia, medicamentos, alergias y enfermedades se tratan como datos personales sensibles. Sólo se usan para mostrar advertencias en las fichas; nunca para diagnosticar, perfilar con fines comerciales ni mostrar publicidad.', 'Si decides sincronizarlos con tu cuenta, lo harás con consentimiento expreso y revocable; se almacenan en una tabla a la que sólo tú puedes acceder (ni siquiera el personal de HerbaNatura).'] },
  { h: '3. Datos de cuenta', p: ['Si creas una cuenta tratamos tu correo electrónico y nombre visible para autenticarte. El historial de búsquedas sólo se guarda en la nube si lo activas expresamente.'] },
  { h: '4. HerbaAI e identificación por imagen', p: ['Las preguntas a HerbaAI y las imágenes para identificación se envían al proveedor de IA configurado únicamente para generar la respuesta. No guardamos las imágenes. El texto de las preguntas sólo se conserva si das tu consentimiento, durante un máximo de 30 días, para mejorar la calidad y la seguridad.'] },
  { h: '5. Derechos', p: ['Puedes acceder, rectificar, exportar y eliminar tus datos en cualquier momento desde “Mi perfil” (exportar en JSON y borrar todo, incluida la cuenta). También puedes oponerte o revocar consentimientos.'] },
  { h: '6. Seguridad', p: ['Cifrado en tránsito (HTTPS), control de acceso por filas en la base de datos, separación de secretos en el servidor, registros de auditoría y copias de seguridad.'] },
  { h: '7. Publicidad', p: ['La publicidad, si existe, no usa tus datos de salud y nunca aparece en las secciones de cáncer, seguridad o interacciones. Los anunciantes no influyen en la información científica.'] },
  { h: '8. Marco legal', p: ['Esta política se adapta a la legislación aplicable de protección de datos, incluida la mexicana en materia de datos personales en posesión de particulares y, cuando corresponda, el RGPD europeo.'] },
];

const EN: LegalSection[] = [
  { h: '1. Principle: minimal data', p: ['HerbaNatura can be used without an account. By default your favorites, history, collections and health profile are stored only on your device (browser local storage) and are not sent to our servers.'] },
  { h: '2. Health data (sensitive data)', p: ['Age band, sex, pregnancy, breastfeeding, medicines, allergies and conditions are treated as sensitive personal data. They are used only to show warnings on entries — never to diagnose, profile commercially or target ads.', 'If you choose to sync them to your account, you do so with explicit, revocable consent; they are stored in a table only you can access (not even HerbaNatura staff).'] },
  { h: '3. Account data', p: ['If you create an account we process your email and display name to authenticate you. Search history is stored in the cloud only if you explicitly enable it.'] },
  { h: '4. HerbaAI and image identification', p: ['HerbaAI questions and identification images are sent to the configured AI provider only to produce the answer. We do not store images. Question text is kept only with your consent, for at most 30 days, to improve quality and safety.'] },
  { h: '5. Your rights', p: ['You can access, correct, export and delete your data at any time from “My profile” (JSON export and delete everything, including the account). You can also object or withdraw consent.'] },
  { h: '6. Security', p: ['Encryption in transit (HTTPS), row-level access control in the database, server-side secrets, audit logs and backups.'] },
  { h: '7. Advertising', p: ['Advertising, if any, never uses your health data and never appears in cancer, safety or interaction sections. Advertisers do not influence scientific information.'] },
  { h: '8. Legal framework', p: ['This policy follows applicable data-protection law, including Mexican law on personal data held by private parties and, where applicable, the EU GDPR.'] },
];

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await pageContext(params);
  return (
    <LegalPage
      title={locale === 'es' ? 'Política de privacidad' : 'Privacy policy'}
      updated={locale === 'es' ? 'Versión 0.1 · 3 de octubre de 2026' : 'Version 0.1 · October 3, 2026'}
      reviewNote={locale === 'es' ? 'Borrador: debe revisarlo un profesional jurídico antes del lanzamiento, e incluir la identidad y domicilio del responsable.' : 'Draft: must be reviewed by a legal professional before launch and include the controller’s identity and address.'}
      sections={locale === 'es' ? ES : EN}
    />
  );
}
