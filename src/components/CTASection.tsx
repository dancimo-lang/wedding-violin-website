import Link from 'next/link';

interface CTASectionProps {
  title: string;
  description?: string;
  buttonText: string;
  href: string;
  variant?: 'primary' | 'dark' | 'light';
}

export default function CTASection({
  title,
  description,
  buttonText,
  href,
  variant = 'primary',
}: CTASectionProps) {
  const variants = {
    primary: {
      bg: 'bg-gradient-to-r from-blue-600 to-blue-700',
      text: 'text-white drop-shadow-[0_0_20px_rgba(0,174,239,0.5)]',
      descText: 'text-blue-100',
      button: 'bg-white text-blue-700 hover:bg-blue-50 shadow-[0_0_25px_rgba(255,255,255,0.3)] hover:shadow-[0_0_35px_rgba(255,255,255,0.5)]',
    },
    dark: {
      bg: 'bg-gradient-to-br from-blue-950 to-blue-900',
      text: 'text-white drop-shadow-[0_0_20px_rgba(0,174,239,0.4)]',
      descText: 'text-blue-200',
      button: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-400 hover:to-blue-500 shadow-[0_0_25px_rgba(0,174,239,0.5)] hover:shadow-[0_0_35px_rgba(0,174,239,0.7)]',
    },
    light: {
      bg: 'bg-gradient-to-br from-blue-900/20 to-blue-800/10',
      text: 'text-blue-50 drop-shadow-[0_0_15px_rgba(0,174,239,0.4)]',
      descText: 'text-blue-200',
      button: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-400 hover:to-blue-500 shadow-[0_0_25px_rgba(0,174,239,0.5)] hover:shadow-[0_0_35px_rgba(0,174,239,0.7)]',
    },
  };

  const styles = variants[variant];

  return (
    <section className={`${styles.bg} py-16 md:py-20`}>
      <div className="container mx-auto px-4 text-center">
        <h2 className={`text-3xl md:text-4xl font-bold ${styles.text} mb-4`}>
          {title}
        </h2>
        {description && (
          <p className={`text-lg ${styles.descText} mb-8 max-w-2xl mx-auto`}>
            {description}
          </p>
        )}
        <Link
          href={href}
          className={`inline-block ${styles.button} px-8 py-4 rounded-full font-semibold text-lg transition-all`}
        >
          {buttonText}
        </Link>
      </div>
    </section>
  );
}
