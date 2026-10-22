import { createPageMetadata } from '@/lib/page-metadata';

export const metadata = createPageMetadata({
  title: 'Pay your wedding music',
  description: 'Pay the retainer or balance for wedding music with Daniel Cimo.',
  path: '/pay',
  noIndex: true,
});

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
