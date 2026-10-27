import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/login/mfa',
  '/set-password',
  '/auth/callback',
  '/api/health',
]);

export function buildCspHeader(nonce: string, supabaseUrl?: string): string {
  let supabaseOrigin = '';
  if (supabaseUrl) {
    try {
      supabaseOrigin = new URL(supabaseUrl).origin;
    } catch {
      supabaseOrigin = '';
    }
  }

  const connectSrc = supabaseOrigin
    ? `'self' ${supabaseOrigin}`
    : "'self'";
  const frameSrc = supabaseOrigin
    ? `'self' ${supabaseOrigin}`
    : "'self'";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCspHeader(nonce, process.env.NEXT_PUBLIC_SUPABASE_URL);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const { pathname } = request.nextUrl;
  const isDevUi =
    pathname.startsWith('/dev/ui') && process.env.APP_ENV !== 'production';
  const isPublic = PUBLIC_PATHS.has(pathname) || isDevUi;

  if (!isPublic && pathname.startsWith('/dev/ui')) {
    return new NextResponse('Tidak ditemukan', { status: 404 });
  }

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Penegakan Autentikasi dan MFA AAL2 di tingkat Middleware (FR-F1.1 & SECURITY S-01)
  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/k/') ||
    pathname.startsWith('/api/k/');

  if (isProtectedPath) {
    const demoSession = request.cookies.get('kasdapur_session')?.value;
    const isDemoAllowed =
      process.env.NEXT_PUBLIC_DEMO === 'true' &&
      process.env.APP_ENV !== 'production';

    // Jika sesi demo aktif pada lingkungan pengembangan/demo
    if (isDemoAllowed && demoSession === 'authenticated') {
      // Izinkan sesi demo
    } else if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      try {
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          {
            cookies: {
              getAll() {
                return request.cookies.getAll();
              },
              setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) =>
                  request.cookies.set(name, value),
                );
                response = NextResponse.next({
                  request: {
                    headers: requestHeaders,
                  },
                });
                cookiesToSet.forEach(({ name, value, options }) =>
                  response.cookies.set(name, value, options),
                );
              },
            },
          },
        );

        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr || !user) {
          if (pathname.startsWith('/api/')) {
            return NextResponse.json(
              {
                error:
                  'Sesi tidak valid atau telah berakhir. Silakan login terlebih dahulu.',
              },
              { status: 401 },
            );
          }
          return NextResponse.redirect(new URL('/login', request.url));
        }

        const { data: aal } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (aal?.currentLevel !== 'aal2') {
          if (pathname.startsWith('/api/')) {
            return NextResponse.json(
              {
                error:
                  'Verifikasi autentikasi dua faktor (MFA AAL2) diperlukan.',
              },
              { status: 403 },
            );
          }
          return NextResponse.redirect(new URL('/login/mfa', request.url));
        }
      } catch {
        // Jika klien gagal menghubungi auth server pada rute terlindungi
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: 'Gagal memverifikasi sesi autentikasi.' },
            { status: 401 },
          );
        }
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }
  }

  const isUploadFileRoute =
    pathname.includes('/uploads/') && pathname.endsWith('/file');
  if (isUploadFileRoute) {
    const fileCsp = csp
      .replace("frame-ancestors 'none'", "frame-ancestors 'self'")
      .replace("object-src 'none'", "object-src 'self'");
    response.headers.set('Content-Security-Policy', fileCsp);
  } else {
    response.headers.set('Content-Security-Policy', csp);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
