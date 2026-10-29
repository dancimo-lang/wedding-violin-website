import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCard } from '../auth-card';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = {
  title: 'New password',
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthCard title="New password">
      <Suspense fallback={<p className="text-gray-600">Loading...</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
