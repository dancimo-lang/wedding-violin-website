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
  /** 'gold': cream cards with gold accents (weddings page). */
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
  tone = 'default',
}: PackageCardProps) {
  if (tone === 'gold') {
    return <GoldPackageCard {...{ id, name, price, features, popular, ctaText, ctaHref, details }} />;
  }
  const detailItems = details.filter((item) => item.value.trim() !== '');
  // Keep any #hash at the end so ?package= lands in the query string.
  const [hrefPath, hrefHash] = ctaHref.split('#');
  const href = `${hrefPath}${hrefPath.includes('?') ? '&' : '?'}package=${id}${hrefHash ? `#${hrefHash}` : ''}`;

  return (
    <div
      className={`relative rounded-2xl p-8 transition-all duration-300 ${
        popular
          ? 'bg-amber-700 text-white shadow-xl scale-105'
          : 'bg-white border border-gray-200 shadow-lg hover:shadow-xl'
      }`}
    >
      {popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="bg-gray-900 text-white text-xs font-semibold px-4 py-1.5 rounded-full uppercase tracking-wide">
            Most Popular
          </span>
        </div>
      )}

      <div className="text-center mb-6">
        <h3
          className={`text-xl font-bold mb-2 ${
            popular ? 'text-white' : 'text-gray-900'
          }`}
        >
          {name}
        </h3>
        <p
          className={`text-2xl font-bold ${
            popular ? 'text-amber-100' : 'text-amber-700'
          }`}
        >
          {price}
        </p>
        {duration && (
          <p
            className={`text-sm mt-1 ${
              popular ? 'text-amber-200' : 'text-gray-500'
            }`}
          >
            {duration}
          </p>
        )}
      </div>

      <ul className={`space-y-3 ${detailItems.length > 0 ? 'mb-4' : 'mb-8'}`}>
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <Check
              className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                popular ? 'text-amber-200' : 'text-amber-600'
              }`}
            />
            <span
              className={`text-sm ${
                popular ? 'text-amber-50' : 'text-gray-600'
              }`}
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>

      {detailItems.length > 0 && (
        <ul className="space-y-2 mb-8">
          {detailItems.map((item) => (
            <li key={item.label} className="flex items-start gap-3">
              <Check
                className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  popular ? 'text-amber-200' : 'text-amber-600'
                }`}
              />
              <span
                className={`text-sm ${
                  popular ? 'text-amber-50' : 'text-gray-600'
                }`}
              >
                <span className={`font-medium ${popular ? 'text-white' : 'text-gray-900'}`}>
                  {item.label}:{' '}
                </span>
                {item.value}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Link
        href={href}
        className={`block w-full text-center py-3 px-6 rounded-full font-semibold transition-colors ${
          popular
            ? 'bg-white text-amber-700 hover:bg-gray-100'
            : 'bg-amber-700 text-white hover:bg-amber-800'
        }`}
      >
        {ctaText}
      </Link>
    </div>
  );
}

function packageHref(ctaHref: string, id: string) {
  const [hrefPath, hrefHash] = ctaHref.split('#');
  return `${hrefPath}${hrefPath.includes('?') ? '&' : '?'}package=${id}${hrefHash ? `#${hrefHash}` : ''}`;
}

function GoldPackageCard({
  id,
  name,
  price,
  features,
  popular,
  ctaText,
  ctaHref,
  details,
}: Required<Omit<PackageCardProps, 'duration' | 'tone'>>) {
  const detailItems = details.filter((item) => item.value.trim() !== '');
  return (
    <div
      className={`relative flex flex-col rounded-xl bg-[#fbf7ee] p-8 text-[#2a2620] ${
        popular ? 'border-2 border-[#c9a961] shadow-lg' : 'border border-[#e4d9c3] shadow-sm'
      }`}
    >
      {popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="bg-[#14171f] text-[#e6cf95] text-xs font-semibold px-4 py-1.5 rounded-full uppercase tracking-widest">
            Most Popular
          </span>
        </div>
      )}
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold mb-2 text-[#1d1a15]">{name}</h3>
        <p className="text-2xl font-semibold text-[#7a5c1e]">{price}</p>
        <div className="mx-auto mt-4 h-px w-12 bg-[#c9a961]" aria-hidden="true" />
      </div>
      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#9a7a35]" aria-hidden="true" />
            <span className="text-sm text-[#4a4338]">{feature}</span>
          </li>
        ))}
        {detailItems.map((item) => (
          <li key={item.label} className="flex items-start gap-3">
            <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#9a7a35]" aria-hidden="true" />
            <span className="text-sm text-[#4a4338]">
              <span className="font-medium text-[#1d1a15]">{item.label}: </span>
              {item.value}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href={packageHref(ctaHref, id)}
        className="block w-full text-center py-3 px-6 rounded-full font-semibold transition-colors bg-[#14171f] text-[#f3ede0] hover:bg-[#2a3040] border border-[#14171f]"
      >
        {ctaText}
      </Link>
    </div>
  );
}
