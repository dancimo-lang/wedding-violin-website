import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type AdminButtonVariant = 'primary' | 'secondary' | 'danger';
export type AdminButtonSize = 'md' | 'sm';

const base = [
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold shadow-sm',
  'cursor-pointer transition',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a961] focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none',
  'disabled:hover:bg-gray-200 disabled:hover:text-gray-500 disabled:hover:translate-y-0 disabled:active:translate-y-0',
].join(' ');

const sizes: Record<AdminButtonSize, string> = {
  md: 'px-4 py-2.5 text-sm',
  sm: 'px-3 py-1.5 text-sm',
};

const variants: Record<AdminButtonVariant, string> = {
  primary: 'bg-[#14171f] text-[#f4eddc] hover:bg-[#2a3040] hover:shadow active:translate-y-px active:bg-[#0c0e13]',
  secondary: 'border border-[#14171f] bg-white text-[#14171f] hover:bg-[#f4eddc] hover:shadow active:translate-y-px active:bg-[#e9e3d6]',
  danger: 'bg-red-700 text-white hover:bg-red-800 hover:shadow active:translate-y-px active:bg-red-950',
};

export function adminButtonClass(variant: AdminButtonVariant = 'primary', size: AdminButtonSize = 'md', extra = '') {
  return [base, sizes[size], variants[variant], extra].filter(Boolean).join(' ');
}

type AdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
};

export const AdminButton = forwardRef<HTMLButtonElement, AdminButtonProps>(function AdminButton(
  { variant = 'primary', size = 'md', className = '', type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} className={adminButtonClass(variant, size, className)} {...props} />;
});
