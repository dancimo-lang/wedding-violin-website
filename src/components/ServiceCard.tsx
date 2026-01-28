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
      className={`group block p-8 rounded-3xl transition-all duration-300 ${
        featured
          ? 'bg-gradient-to-br from-blue-900/60 to-blue-800/40 shadow-[0_0_30px_rgba(0,174,239,0.4)] hover:shadow-[0_0_40px_rgba(0,174,239,0.6)] border-2 border-blue-500/30 backdrop-blur-sm'
          : 'bg-gradient-to-br from-blue-900/40 to-blue-800/20 hover:from-blue-900/60 hover:to-blue-800/40 hover:shadow-[0_0_30px_rgba(0,174,239,0.4)] backdrop-blur-sm border border-blue-500/20'
      }`}
    >
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center mb-6 group-hover:from-blue-400 group-hover:to-blue-600 transition-all shadow-[0_0_20px_rgba(0,174,239,0.5)] group-hover:shadow-[0_0_30px_rgba(0,174,239,0.7)]">
          <Icon className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-3 drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">{title}</h3>
        <p className="text-white/90 mb-4 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">{description}</p>
        <span className="text-white/80 font-medium group-hover:underline group-hover:text-white transition-colors drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
          Learn More →
        </span>
      </div>
    </Link>
  );
}
