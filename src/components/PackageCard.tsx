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
}: PackageCardProps) {
  const href = ctaHref.includes('?')
    ? `${ctaHref}&package=${id}`
    : `${ctaHref}?package=${id}`;

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

      <ul className="space-y-3 mb-8">
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
