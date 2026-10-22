import { createPageMetadata } from '@/lib/page-metadata';

export const metadata = {
  ...createPageMetadata({
    title: 'QR Code',
    description:
      'Generate, scan, and download a QR code that links directly to https://danielcimo.com for Daniel Cimo, a violinist in San Luis Obispo on the Central Coast.',
    path: '/qr',
  }),
  robots: {
    index: false,
    follow: true,
  },
};

export default function QrLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
