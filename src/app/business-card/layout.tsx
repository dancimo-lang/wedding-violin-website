import { createPageMetadata } from '@/lib/page-metadata';

export const metadata = createPageMetadata({
  title: 'Business Card',
  description:
    'Print traditional front-and-back wallet business cards, 3.5 by 2 inches, for Daniel Cimo, San Luis Obispo violinist, including a QR code to danielcimo.com.',
  path: '/business-card',
});

export default function BusinessCardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
