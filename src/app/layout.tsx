import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

export const dynamic = 'force-dynamic';

export const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Kasdapur — Pembukuan Buku Kas per Dapur',
  description:
    'Dari bukti transfer ke buku kas Excel per dapur, dengan pemeriksaan manusia sebelum disimpan.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="id" className={plex.variable} nonce={nonce}>
      <body className="min-h-screen bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
