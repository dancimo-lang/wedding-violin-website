import Link from 'next/link';
import { Check } from 'lucide-react';

interface PackageCardProps {
  id: string;
  name: string;
  price: string;
  features: string[];
  popular?: boolean;
  ctaText?: string;
  ctaHref?: string;
  duration?: string;
  details?: { label: string; value: string }[];
  /** Both tones use the cream-and-gold card. */
  tone?: 'default' | 'gold';
}

export default function PackageCard({
  id,
  name,
  price,
  features,
  popular = false,
  ctaText = 'Request Quote',
  ctaHref = '/booking',
  duration,
  details = [],
}: PackageCardProps) {
  const detailItems = details.filter((item) => item.value.trim() !== '');
  const [hrefPath, hrefHash] = ctaHref.split('#');
  const href = `${hrefPath}${hrefPath.includes('?') ? '&' : '?'}package=${id}${hrefHash ? `#${hrefHash}` : ''}`;

  return (
    <div
      className={`relative flex flex-col rounded-xl bg-cream-card p-8 text-ink ${
        popular ? 'border-2 border-gold shadow-lg' : 'border border-cream-line shadow-sm'
      }`}
    >
      {popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="bg-charcoal text-gold-bright text-xs font-semibold px-4 py-1.5 rounded-full uppercase tracking-widest">
            Most Popular
          </span>
        </div>
      )}
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold mb-2 text-ink">{name}</h3>
        <p className="text-2xl font-semibold text-gold-deep">{price}</p>
        {duration && <p className="text-sm mt-1 text-ink-soft">{duration}</p>}
        <div className="mx-auto mt-4 h-px w-12 bg-gold" aria-hidden="true" />
      </div>
      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-gold-icon" aria-hidden="true" />
            <span className="text-sm text-ink-body">{feature}</span>
          </li>
        ))}
        {detailItems.map((item) => (
          <li key={item.label} className="flex items-start gap-3">
            <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-gold-icon" aria-hidden="true" />
            <span className="text-sm text-ink-body">
              <span className="font-medium text-ink">{item.label}: </span>
              {item.value}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className="block w-full text-center py-3 px-6 rounded-full font-semibold transition-colors bg-charcoal text-cream-bright hover:bg-charcoal-hover border border-charcoal"
      >
        {ctaText}
      </Link>
    </div>
  );
}
