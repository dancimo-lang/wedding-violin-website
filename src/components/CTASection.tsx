import Link from 'next/link';
import { btnGold } from '@/lib/theme';

interface CTASectionProps {
  title: string;
  description?: string;
  buttonText: string;
  href: string;
  variant?: 'primary' | 'dark' | 'light' | 'gold';
}

export default function CTASection({
  title,
  description,
  buttonText,
  href,
  variant = 'primary',
}: CTASectionProps) {
  const light = variant === 'light';
  const bg = light ? 'bg-cream' : 'bg-charcoal border-t border-gold/40';
  const heading = light ? 'text-ink' : 'text-cream-bright';
  const body = light ? 'text-ink-body' : 'text-cream-muted';

  return (
    <section className={`${bg} py-16 md:py-20`}>
      <div className="container mx-auto px-4 text-center">
        <h2 className={`text-3xl md:text-4xl font-semibold ${heading} mb-4`}>
          {title}
        </h2>
        {description && (
          <p className={`text-lg ${body} mb-8 max-w-2xl mx-auto`}>
            {description}
          </p>
        )}
        <Link href={href} className={btnGold}>
          {buttonText}
        </Link>
      </div>
    </section>
  );
}
