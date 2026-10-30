import type { Metadata } from 'next';
import { AuthCard } from '../auth-card';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = {
  title: 'Forgot password',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot password">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
