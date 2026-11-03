import Link from 'next/link';
import { Heart, GraduationCap, Mic, LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  Heart,
  GraduationCap,
  Mic,
};

interface ServiceCardProps {
  title: string;
  description: string;
  icon: string;
  href: string;
  featured?: boolean;
}

export default function ServiceCard({
  title,
  description,
  icon,
  href,
  featured = false,
}: ServiceCardProps) {
  const Icon = iconMap[icon] || Heart;

  return (
    <Link
      href={href}
      className={`group block p-8 rounded-xl bg-cream-card transition-colors ${
        featured
          ? 'border-2 border-gold shadow-sm'
          : 'border border-cream-line hover:border-gold'
      }`}
    >
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 border border-gold rounded-full flex items-center justify-center mb-6">
          <Icon className="w-8 h-8 text-gold-deep" />
        </div>
        <h3 className="text-xl font-semibold text-ink mb-3">{title}</h3>
        <p className="text-ink-body mb-4">{description}</p>
        <span className="text-gold-deep font-medium group-hover:underline">
          Learn More →
        </span>
      </div>
    </Link>
  );
}
