import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from '@/lib/i18n/config';

const PUBLIC_FILE = /\.[a-z0-9]+$/i;

function preferredLocale(req: NextRequest) {
  const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  const accept = req.headers.get('accept-language') ?? '';
  return accept.toLowerCase().startsWith('en') ? 'en' : DEFAULT_LOCALE;
}

/** Session refresh is only needed where the server reads the user (keeps public pages cacheable). */
const NEEDS_SESSION = /^\/(es|en)\/(admin|perfil|entrar)(\/|$)|^\/auth\//;

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.startsWith('/auth') || PUBLIC_FILE.test(pathname)) {
    return NEEDS_SESSION.test(pathname) ? refreshSession(req) : NextResponse.next();
  }
  const first = pathname.split('/')[1];
  if (!isLocale(first)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${preferredLocale(req)}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url);
  }
  return NEEDS_SESSION.test(pathname) ? refreshSession(req) : NextResponse.next();
}

async function refreshSession(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let res = NextResponse.next({ request: req });
  if (!url || !key) return res;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
