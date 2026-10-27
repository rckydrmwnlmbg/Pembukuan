import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = new Set(['/', '/login', '/login/mfa', '/api/health']);

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

export function middleware(request: NextRequest): NextResponse {
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

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

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
