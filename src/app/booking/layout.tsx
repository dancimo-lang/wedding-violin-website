import site from '@/data/site.json';
import { createPageMetadata } from '@/lib/page-metadata';

export const metadata = createPageMetadata({
  title: 'Booking',
  description:
    `Book a wedding, proposal, private lessons, or studio recording. Fill out the form and Daniel replies within 24-48 hours, or email him at ${site.email}.`,
  path: '/booking',
});

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
