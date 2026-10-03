import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Locale } from '@/lib/domain/types';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { hasFeature } from '@/lib/auth/session';
import { serverEnv } from '@/lib/env';
import type { Feature } from '@/lib/plans';
import { Notice, Pill } from '@/components/ui';

export async function PremiumGate({ feature, children, dict, locale }: { feature: Feature; children: ReactNode; dict: Dictionary; locale: Locale }) {
  if (await hasFeature(feature)) {
    return (
      <>
        <div className="mb-4">
          <Pill tone="info">⭐ {serverEnv.premiumEnforced ? dict.common.premium : dict.common.premiumDemo}</Pill>
        </div>
        {children}
      </>
    );
  }
  return (
    <Notice tone="info" title={`⭐ ${dict.common.premium}`}>
      {locale === 'es' ? 'Esta función forma parte del plan Premium. La información científica básica y de seguridad es siempre gratuita.' : 'This feature is part of Premium. Basic scientific and safety information is always free.'}{' '}
      <Link href={`/${locale}/premium`} className="underline">{dict.nav.premium} →</Link>
    </Notice>
  );
}
