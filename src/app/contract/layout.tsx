import { createPageMetadata } from '@/lib/page-metadata';

export const metadata = createPageMetadata({
  title: 'Sign your agreement',
  description: 'Read and sign the wedding music agreement from Daniel Cimo.',
  path: '/contract',
  noIndex: true,
});

export default function ContractLayout({ children }: { children: React.ReactNode }) {
  return children;
}
